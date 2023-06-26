'use strict';

const { OAuth2Client } = require('homey-oauth2app');
const Homey = require('homey');

module.exports = class NukiOAuth2Client extends OAuth2Client {

  // Documentation: https://developer.nuki.io/page/nuki-bridge-http-api-1-13/4/
  static API_URL = 'https://api.nuki.io';
  static TOKEN_URL = 'https://api.nuki.io/oauth/token';
  static AUTHORIZATION_URL = 'https://api.nuki.io/oauth/authorize';
  static SCOPES = [
    'account',
    'notification',
    'smartlock',
    'smartlock.action',
    'webhook.decentral',
  ];

  // Smart Lock Actions
  static LOCK_ACTION_UNLOCK = 1;
  static LOCK_ACTION_LOCK = 2;
  static LOCK_ACTION_UNLATCH = 3;
  static LOCK_ACTION_LOCK_N_GO = 4;
  static LOCK_ACTION_LOCK_N_GO_UNLATCH = 5;
  static LOCK_ACTION_DOOR_OPENED = 240;
  static LOCK_ACTION_DOOR_CLOSED = 241;
  static LOCK_ACTION_DOOR_SENSOR_JAMMED = 242;

  // Smart Lock States
  static LOCK_STATE_UNCALIBRATED = 0;
  static LOCK_STATE_LOCKED = 1;
  static LOCK_STATE_UNLOCKING = 2;
  static LOCK_STATE_UNLOCKED = 3;
  static LOCK_STATE_LOCKING = 4;
  static LOCK_STATE_UNLATCHED = 5;
  static LOCK_STATE_UNLOCKED_LOCK_N_GO = 6;
  static LOCK_STATE_UNLATCHING = 7;
  static LOCK_STATE_MOTOR_BLOCKED = 254;

  // Doorsensor States
  static DOOR_STATE_DEACTIVATED = 1;
  static DOOR_STATE_CLOSED = 2;
  static DOOR_STATE_OPENED = 3;
  static DOOR_STATE_UNKNOWN = 4;
  static DOOR_STATE_CALIBRATING = 5;

  // Opener States
  static OPENER_STATE_UNTRAINED = 0;
  static OPENER_STATE_ONLINE = 1;
  static OPENER_STATE_RTO_ACTIVE = 3;
  static OPENER_STATE_OPEN = 5;
  static OPENER_STATE_OPENING = 7;
  static OPENER_STATE_BOOT_RUN = 253;

  // Device Type
  static DEVICE_TYPE_SMARTLOCK = 0;
  static DEVICE_TYPE_OPENER = 2;
  static DEVICE_TYPE_SMARTDOOR = 3;
  static DEVICE_TYPE_SMARTLOCK3 = 4; // Nuki 3.0 Pro

  // Server States
  static SERVER_STATE_OK = 0;
  static SERVER_STATE_UNREGISTERED = 1;
  static SERVER_STATE_UUID_INVALID = 2;
  static SERVER_STATE_AUTH_INVALID = 3;
  static SERVER_STATE_OFFLINE = 4;

  async onInit() {
    await super.onInit();

    this._devices = new Map();
    this._webhookRegistering = false;
    this._nukiWebhook = null;
    this._cloudWebhook = null;
  }

  registerDevice(smartlockId, {
    onWebhook = () => { },
  }) {
    if (this._devices.has(smartlockId)) return;

    this._devices.set(smartlockId, { onWebhook });
    this.log(`Registering device: ${smartlockId}`);

    if (this._devices.size === 1) {
      this.log('First devices registered, registering webhook...');
      this.registerWebhook()
        .catch(this.error)
        .finally(() => {
          this._webhookRegistering = false;
        });
    }
  }

  unregisterDevice(smartlockId) {
    if (!this._devices.has(smartlockId)) return;

    this._devices.delete(smartlockId);
    this.log(`Unregistering device: ${smartlockId}`);

    if (this._devices.size === 0) {
      this.log('No devices registered, unregistering webhook...');
      this.unregisterWebhook()
        .catch(this.error)
        .finally(() => {
          this._webhookRegistered = false;
        });
    }
  }

  async registerWebhook() {
    if (this._nukiWebhook && this._cloudWebhook) return;
    if (this._webhookRegistering) return;
    this._webhookRegistering = true;

    const webhooks = await this.getDecentralWebhooks();
    const homeyId = await this.homey.cloud.getHomeyId();
    const webhookUrl = `https://webhooks.athom.com/webhook/${Homey.env.WEBHOOK_ID}?homey=${homeyId}`;

    this._nukiWebhook = webhooks.find(webhook => {
      return webhook.webhookUrl === webhookUrl;
    });

    if (this._nukiWebhook) {
      this.log('Nuki webhook already registered');
    } else {
      this.log('Registering Nuki webhook...');
      this._nukiWebhook = await this.createDecentralWebhook({ webhookUrl });
      this.log('Nuki webhook registered', this._nukiWebhook);
    }

    this.log('Register Cloud webhook');
    this._cloudWebhook = await this.homey.cloud.createWebhook(Homey.env.WEBHOOK_ID, Homey.env.WEBHOOK_SECRET, { homeyId });
    this._cloudWebhook.on('message', ({ body }) => {
      this.log('onWebhookMessage', JSON.stringify(body, false, 2));
      let id;
      let data;

      switch (body.feature) {
        case 'DEVICE_STATUS': {
          if (body.smartlockId) {
            id = body.smartlockId;
            data = {
              deviceState: body.state,
              serverState: body.serverState,
            };
          }
          break;
        }
        case 'DEVICE_LOGS': {
          // if (body.smartlockLog) {
          //   id = body.smartlockLog.smartlockId;
          //   data = { ...body.smartlockLog };
          // }
          break;
        }
        default: {
          this.log(`Unknown Webhook Feature: ${body.feature}`);
        }
      }

      if (id && data) {
        const device = this._devices.get(id);
        if (device) {
          Promise.resolve().then(async () => {
            device.onWebhook(data);
          }).catch(err => `Error Calling Device.onWebook: ${err.messsage}`);
        }
      }
    });
  }

  async unregisterWebhook() {
    if (this._nukiWebhook) {
      this.log('Unregister Nuki webhook', this._nukiWebhook.id);
      this.deleteDecentralWebhook({ id: this._nukiWebhook.id })
        .catch(this.error);
      this._nukiWebhook = null;
    }

    if (this._cloudWebhook) {
      this.log('Unregister Cloud webhook');
      this.homey.cloud.unregisterWebhook(this._cloudWebhook)
        .catch(this.error);
      this._cloudWebhook = null;
    }
  }

  /**
   * API CALLS
   */

  async getSmartlocks() {
    return this.get({
      path: '/smartlock',
    });
  }

  async getSmartlock({ smartlockId }) {
    return this.get({
      path: `/smartlock/${smartlockId}`,
    });
  }

  async setSmartlockLocked({ smartlockId, action }) {
    return this.post({
      path: `/smartlock/${smartlockId}/action`,
      json: {
        action,
        config: 0,
      },
    });
  }

  async sync({ smartlockId }) {
    return this.post({
      path: `/smartlock/${smartlockId}/sync`,
    });
  }

  async getDecentralWebhooks() {
    return this.get({
      path: '/api/decentralWebhook',
    });
  }

  async createDecentralWebhook({
    id,
    secret,
    webhookUrl,
    webhookFeatures = [
      'DEVICE_STATUS',
      'DEVICE_LOGS',
    ],
  }) {
    return this.put({
      path: '/api/decentralWebhook',
      json: {
        id,
        secret,
        webhookUrl,
        webhookFeatures,
      },
    });
  }

  async deleteDecentralWebhook({ id }) {
    return this.delete({
      path: `/api/decentralWebhook/${id}`,
    });
  }

  /**
   * Overrides for nuki.io api returning the wrong content type for the token response
   */
  async onHandleGetTokenByCodeResponse({ response }) {
    return this._onHandleCustomGetTokenByResponseGeneric({ response });
  }

  async onHandleGetTokenByCredentialsResponse({ response }) {
    return this._onHandleCustomGetTokenByResponseGeneric({ response });
  }

  async onHandleRefreshTokenResponse({ response }) {
    return this._onHandleCustomGetTokenByResponseGeneric({ response });
  }

  /**
   * Because of an error in the nuki.io API their content-type returned is text/plain instead of application/json
   *
   * @param response
   * @returns {Promise<*>}
   * @private
   */
  async _onHandleCustomGetTokenByResponseGeneric({ response }) {
    const { headers } = response;
    const contentType = headers.get('Content-Type');

    if (typeof contentType === 'string') {
      const json = await response.json();

      return new this._tokenConstructor({
        ...this._token, // merge with old token for properties such as refresh_token
        ...json,
      });
    }
    throw new Error('Could not parse Token Response');
  }

};
