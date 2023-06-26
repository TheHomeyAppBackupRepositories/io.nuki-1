'use strict';

const NukiHomeyDriver = require('../../lib/NukiHomeyDriver');
const {
  DEVICE_TYPE_OPENER,
} = require('../../lib/NukiOAuth2Client');

module.exports = class NukiOpenerDriver extends NukiHomeyDriver {

  onFilterDevice(device) {
    return device.type === DEVICE_TYPE_OPENER;
  }

};
