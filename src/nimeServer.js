'use strict';

const debug = require('debug')('nime:server');
const stdio = require('stdio');
const { promisify } = require('util');

const { initService, handleRequest } = require('./requestHandler');

stdio.readByLines = promisify(stdio.readByLines);

const createServer = async (services = []) => {
  const connections = {};

  // handle client requests
  const handleClientRequest = async (clientId, request) => {
    debug(clientId);
    debug(request);

    if (!connections.hasOwnProperty(clientId)) {
      debug(`Connection not found ${clientId}`);
      return {};
    }

    if (request['method'] === 'init') {
      let { service, state, response } = await initService(request, services);
      connections[clientId] = { service, state };
      debug(response);
      return response;
    } else {
      let { state, response } = await handleRequest(
        request,
        connections[clientId]
      );
      connections[clientId].state = state;
      debug(response);
      return response;
    }

    return {};
  };

  // Delete client, http url: /clientId
  const removeClient = clientId => {
    debug(clientId);

    if (clientId === '') {
      // Exit the IME server
      process.exit();
    }

    if (!connections.hasOwnProperty(clientId)) {
      debug(`Connection not found ${clientId}`);
      return;
    }

    delete connections[clientId];
  };

  const listen = async () => {
    try {
      const line = await stdio.readByLines();
      line = line.trim();
      const parts = line.split('|', 2);

      if (parts.length == 2) {
        const clientId = parts[0];
        const msgText = parts[1];
        const msg = JSON.parse(msgText);
        let client;

        if (!connections.hasOwnProperty(clientId)) {
          client = { service: null, state: null };
          connections[clientId] = client;
          debug('new client', clientId);
        }

        if (msg['method'] === 'close') {
          // special handling for closing a client
          removeClient(clientId);
          debug('client disconnected:', clientId + '\n');
        } else {
          const ret = await handleClientRequest(clientId, msg);
          // Send the response to the client via stdout
          // one response per line in the format "PIME_MSG|<client_id>|<json reply>"
          const reply_line =
            'PIME_MSG|' + clientId + '|' + JSON.stringify(ret) + '\n';
          process.stdout.write(reply_line);
        }
      }
    } catch (error) {
      console.log('finished');
    }
  };
  return { listen };
};

module.exports = {
  createServer
};
