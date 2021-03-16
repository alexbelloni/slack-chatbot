const { RTMClient } = require('@slack/rtm-api');
const { WebClient } = require('@slack/web-api');

//https://slack.dev/node-slack-sdk/reference/rtm-api
//https://api.slack.com/rtm
//https://api.slack.com/web#methods

const ClientRTM = (slackToken, reconnectTimeout) => {
    let rtm = new RTMClient(slackToken, {
        autoReconnect: true,
        replyAckOnReconnectTimeout: (reconnectTimeout * 60) * 1000
    });
    let web = new WebClient(slackToken);

    function sendMessage(message, channel) {
        return rtm.sendMessage(message, channel);
    }

    function receiveMessage(message) {
        // [0]: Username, [1]: Command, [2]: Options, [3] arguments
        // e.g. text: '<@UV53WS25T> APOD me today
        var arr = message.text.split(' ').map(part => part && part.trim());
        return { ...message, command: arr[1], option: arr[2], argument: arr[3] }
    }

    function getRTM() {
        return rtm;
    }

    function getWeb() {
        return web;
    }

    return {
        sendMessage,
        receiveMessage,
        getRTM,
        getWeb
    }
}

module.exports = ClientRTM;

