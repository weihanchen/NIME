'use strict';

let LOG = require('./util/logger');

const SUCCESS          = 0;
const ERROR_MORE_DATA  = 234;
const ERROR_IO_PENDING = 997;

const NO_ACTION    = 0;
const NEXT_READ    = 1;
const CLOSE_SOCKET = 2;


function createSocket(ref, pipe, server, services) {

  let readData = '';
  let message  = {};
  let service  = null;
  let open     = false;
  let state    = {'env': {}};

  function _handleRequest(request) {
    let response = {success: false, seqNum: request['seqNum']};

    if (request['method'] === 'init') {
      // Search the service
      services.forEach((tmpService) => {
        if (tmpService['guid'].toLowerCase() === request['id'].toLowerCase()) {
          service = tmpService['textService'];
          open    = true;
        }
      });

      // Store environment
      state.env['id']              = request['id'];
      state.env['isWindows8Above'] = request['isWindows8Above'];
      state.env['isMetroApp']      = request['isMetroApp'];
      state.env['isUiLess']        = request['isUiLess'];
      state.env['isConsole']       = request['isConsole'];

    } else if (request['method'] === 'onActivate' && open === true) {
      state.env['isKeyboardOpen'] = request['isKeyboardOpen'];
    }

    if (service !== null && open === true) {
      // Use the text reducer to change state
      state    = service.textReducer(request, state);
      // Handle response
      response = service.response(request, state);
    } else {
      state    = {};
      response = {success: false, seqNum: request['seqNum']};
    }
    this.write(response, () => this.read());
  }

  function _handleMessage(msg) {

    // For client, check server exist or not.
    if (msg === 'ping') {
      this.write('pong', () => this.read());
      return NO_ACTION;
    }

    // For client, quit the server.
    if (msg === 'quit') {
      return CLOSE_SOCKET;
    }

    // Handle the normal message
    this._handleRequest(msg);
    return NO_ACTION;
  };

  function _handleData(err, data) {

    if (err === SUCCESS) {
      readData += data;

      LOG.info('Get Data: ' + readData);
      try {
        message = JSON.parse(readData);
      } catch (e) {
        message = readData;
      }

      readData = "";

      return this._handleMessage(message);
    }

    if (err === ERROR_MORE_DATA) {
      readData += data;
      return NEXT_READ;
    }

    if (err === ERROR_IO_PENDING) {
      return NEXT_READ;
    }

    LOG.info('Socket broken');
    return CLOSE_SOCKET;
  }

  function read() {

    pipe.read(ref, (err, data) => {

      let result = this._handleData(err, data);

      if (result === NEXT_READ) {
        this.read();
      } else if(result === CLOSE_SOCKET){
        this.close();
      }
    });
  }

  function write(response, callback) {

    let data = '';

    try {
      data = JSON.stringify(response);
    } catch (e) {
      data = response;
    }

    pipe.write(ref, response, (err, len) => {

      if (err) {
        LOG.info('Write Failed');
        this.close();
      }

      LOG.info(`Write Len: ${len} Data: ${data}`);
      if (typeof callback !== 'undefined') {
        callback();
      }
    });
  }

  function close() {
    pipe.close(ref, (err) => {
      server.deleteConnection(this);
    });
  }

  return {
    read,
    write,
    close,
    _handleData,
    _handleMessage,
    _handleRequest
  };
}

module.exports = {
  createSocket
};
