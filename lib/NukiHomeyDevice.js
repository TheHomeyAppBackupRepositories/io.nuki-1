'use strict';

const { OAuth2Device } = require('homey-oauth2app');
const {
  SERVER_STATE_OK,
  SERVER_STATE_UNREGISTERED,
  SERVER_STATE_UUID_INVALID,
  SERVER_STATE_AUTH_INVALID,
  SERVER_STATE_OFFLINE,
} = require('./NukiOAuth2Client');

const SYNC_INTERVAL = 1000 * 60 * 15; // 15 min

module.exports = class SmartLockDevice extends OAuth2Device {

  async onOAuth2Init() {
    await super.onOAuth2Init();

    // Register
    if (this.oAuth2Client) {
      const { smartlockId } = this.getData();
      this.oAuth2Client.registerDevice(smartlockId, {
        onWebhook: this.onWebhook.bind(this),
      });
    }

    // Sync
    this.sync().catch(err => {
      this.error(`Error Syncing: ${err.message}`);
      this.setUnavailable(err).catch(this.error);
    });
    this.syncInterval = this.homey.setInterval(() => {
      this.sync().catch(err => this.error(`Error Syncing: ${err.message}`));
    }, SYNC_INTERVAL);
  }

  async onOAuth2Deleted() {
    if (this.oAuth2Client) {
      const { smartlockId } = this.getData();
      this.oAuth2Client.unregisterDevice(smartlockId);
    }

    if (this.syncInterval) {
      this.homey.clearInterval(this.syncInterval);
    }
  }

  async sync() {
    const { smartlockId } = this.getData();
    const { state, serverState } = await this.oAuth2Client.getSmartlock({ smartlockId });

    if (typeof state === 'object') {
      this.onDeviceState(state)
        .catch(err => this.error(`Error Setting Device State: ${err.message}`));
    }

    if (typeof serverState === 'number') {
      this.onServerState(serverState)
        .catch(err => this.error(`Error Setting Server State: ${err.message}`));
    }
  }

  onWebhook({
    deviceState,
    serverState,
  }) {
    this.log('onWebhook', JSON.stringify({ deviceState, serverState }, false, 2));

    if (typeof deviceState === 'object') {
      this.onDeviceState(deviceState)
        .catch(err => this.error(`Error Setting Device State: ${err.message}`));
    }

    if (typeof serverState === 'number') {
      this.onServerState(serverState)
        .catch(err => this.error(`Error Setting Server State: ${err.message}`));
    }
  }

  async onDeviceState() {
    // Overload Me
  }

  async onServerState(serverState) {
    switch (serverState) {
      case SERVER_STATE_OK:
        await this.setAvailable();
        break;
      case SERVER_STATE_UNREGISTERED:
      case SERVER_STATE_UUID_INVALID:
      case SERVER_STATE_AUTH_INVALID:
        await this.setUnavailable();
        break;
      case SERVER_STATE_OFFLINE:
        await this.setUnavailable(this.homey.__('errors.offline'));
        break;
      default:
        break;
    }
  }

};
