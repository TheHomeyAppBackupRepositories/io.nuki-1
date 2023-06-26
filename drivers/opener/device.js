'use strict';

const NukiHomeyDevice = require('../../lib/NukiHomeyDevice');

const {
  LOCK_ACTION_UNLATCH,
  OPENER_STATE_OPENING,
} = require('../../lib/NukiOAuth2Client');

module.exports = class NukiSmartLockDevice extends NukiHomeyDevice {

  async onOAuth2Init() {
    await super.onOAuth2Init();

    this.registerCapabilityListener('locked', this.onCapabilityLocked.bind(this));
    await this.setCapabilityValue('locked', true).catch(this.error);
  }

  /**
   * Lock or unlock the opener
   *
   * @param value
   * @returns {Promise<void>}
   */
  async onCapabilityLocked(value) {
    const { smartlockId } = this.getData();

    if (value === false) {
      await this.oAuth2Client.setSmartlockLocked({
        smartlockId,
        action: LOCK_ACTION_UNLATCH,
      });

      this.homey.setTimeout(() => {
        this.setCapabilityValue('locked', true).catch(this.error);
      }, 2000);
    }
  }

  async onDeviceState({
    batteryCritical,
    state,
  }) {
    if (typeof batteryCritical === 'boolean') {
      this.setCapabilityValue('alarm_battery', batteryCritical).catch(this.error);
    }

    if (state === OPENER_STATE_OPENING) {
      this.setCapabilityValue('locked', false).catch(this.error);

      this.homey.setTimeout(() => {
        this.setCapabilityValue('locked', true).catch(this.error);
      }, 2000);
    }
  }

};
