'use strict';

const NukiHomeyDriver = require('../../lib/NukiHomeyDriver');
const {
  DEVICE_TYPE_SMARTLOCK,
  DEVICE_TYPE_SMARTDOOR,
  DEVICE_TYPE_SMARTLOCK3,
} = require('../../lib/NukiOAuth2Client');

module.exports = class NukiSmartLockDriver extends NukiHomeyDriver {

  async onOAuth2Init() {
    this.homey.flow.getActionCard('unlock_pull_latch')
      .registerRunListener(async ({ device }) => {
        return device.unlockAndPullLatch();
      });
  }

  onFilterDevice(device) {
    return device.type === DEVICE_TYPE_SMARTLOCK
      || device.type === DEVICE_TYPE_SMARTDOOR
      || device.type === DEVICE_TYPE_SMARTLOCK3;
  }

};
