/* eslint-disable default-case */

'use strict';

const NukiHomeyDevice = require('../../lib/NukiHomeyDevice');
const {
  LOCK_STATE_LOCKED,
  LOCK_STATE_UNLOCKED,

  DOOR_STATE_DEACTIVATED,
  DOOR_STATE_OPENED,
  DOOR_STATE_CLOSED,
  DOOR_STATE_UNKNOWN,

  LOCK_ACTION_LOCK,
  LOCK_ACTION_UNLATCH,
  LOCK_ACTION_UNLOCK,
} = require('../../lib/NukiOAuth2Client');

module.exports = class NukiSmartLockDevice extends NukiHomeyDevice {

  async onOAuth2Init() {
    await super.onOAuth2Init();

    this.registerCapabilityListener('locked', this.onCapabilityLocked.bind(this));
  }

  /**
   * Lock or unlock the door
   *
   * @param value
   * @returns {Promise<void>}
   */
  async onCapabilityLocked(value) {
    const { smartlockId } = this.getData();
    const { open_door: openDoor } = this.getSettings();

    let action;
    if (value) {
      action = LOCK_ACTION_LOCK;
    } else if (openDoor) {
      action = LOCK_ACTION_UNLATCH;
    } else {
      action = LOCK_ACTION_UNLOCK;
    }

    return this.oAuth2Client.setSmartlockLocked({
      smartlockId,
      action,
    });
  }

  /**
   * Flow card action: unlock_pull_latch
   *
   * @returns {Promise<void>}
   */
  async unlockAndPullLatch() {
    const { smartlockId } = this.getData();
    await this.oAuth2Client.setSmartlockLocked({
      smartlockId,
      action: LOCK_ACTION_UNLATCH,
    });
  }

  /**
   * Sets the capabilities based on the data returned from sync or webhook
   *
   * @param state
   * @param doorState
   * @param batteryCritical
   */
  async onDeviceState({
    state,
    doorState,
    batteryCritical,
  }) {
    switch (state) {
      case LOCK_STATE_LOCKED: {
        this.setCapabilityValue('locked', true).catch(this.error);
        break;
      }
      case LOCK_STATE_UNLOCKED: {
        this.setCapabilityValue('locked', false).catch(this.error);
        break;
      }
    }

    switch (doorState) {
      case DOOR_STATE_OPENED: {
        this.setCapabilityValue('alarm_contact', true).catch(this.error);
        break;
      }
      case DOOR_STATE_CLOSED: {
        this.setCapabilityValue('alarm_contact', false).catch(this.error);
        break;
      }
      case DOOR_STATE_DEACTIVATED:
      case DOOR_STATE_UNKNOWN: {
        this.setCapabilityValue('alarm_contact', null).catch(this.error);
        break;
      }
    }

    if (typeof batteryCritical === 'boolean') {
      this.setCapabilityValue('alarm_battery', batteryCritical).catch(this.error);
    }
  }

};
