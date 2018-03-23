const textService = require('./textService');

const initService = async (request, services) => {
  let response = { success: false, seqNum: request['seqNum'] };
  let service = null;
  let state = {
    env: {}
  };

  if (typeof services === 'function') {
    // Let user handle services
    service = services(request);
  } else {
    // Search the service
    services.forEach(tmpService => {
      if (tmpService['guid'].toLowerCase() === request['id'].toLowerCase()) {
        service = tmpService['textService'];
      }
    });
  }

  // Store environment
  state.env['id'] = request['id'];
  state.env['isWindows8Above'] = request['isWindows8Above'];
  state.env['isMetroApp'] = request['isMetroApp'];
  state.env['isUiLess'] = request['isUiLess'];
  state.env['isConsole'] = request['isConsole'];

  if (service !== null) {
    // Use the text reducer to change state
    state = await service.textReducer(request, state);
    // Handle response
    response = await service.response(request, state);
  } else {
    state = {};
    response = { success: false, seqNum: request['seqNum'] };
  }

  return { service, state, response };
};

const handleRequest = async (request, { state, service = textService }) => {
  let response = { success: false, seqNum: request['seqNum'] };

  if (request['method'] === 'onActivate') {
    state.env['isKeyboardOpen'] = request['isKeyboardOpen'];
  }

  // Use the text reducer to change state
  state = await service.textReducer(request, state);
  // Handle response
  response = await service.response(request, state);

  return { state, response };
};

module.exports = {
  initService,
  handleRequest
};
