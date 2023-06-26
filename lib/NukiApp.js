'use strict';

const { OAuth2App } = require('homey-oauth2app');

const NukiOAuth2Client = require('./NukiOAuth2Client');

module.exports = class NukiApp extends OAuth2App {

  static OAUTH2_CLIENT = NukiOAuth2Client;
  static OAUTH2_DEBUG = true;

};
