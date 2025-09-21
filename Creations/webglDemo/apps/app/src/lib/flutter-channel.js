class FlutterChannel {
  constructor() {
    if (typeof window !== 'undefined' && !window.onPluginMessage) {
      window.onPluginMessage = function(data) {
        window.dispatchEvent(new CustomEvent('pluginMessage', { detail: data }));
      };
    }
  }

  sendPluginMessage(messageObj) {
    if (!window.PluginMessageHandler) return false;
    try {
      window.PluginMessageHandler.postMessage(JSON.stringify(messageObj));
      return true;
    } catch {
      return false;
    }
  }
}

const flutterChannel = new FlutterChannel();
export default flutterChannel;


