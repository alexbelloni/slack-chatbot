var request = require('request');
var express = require('express');

const dotenv = require('dotenv');
const result = dotenv.config();
if (result.error) {
  throw result.error;
}

var app = express();
var port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('This is chatbot.');
})

app.listen(port, function () {
  console.log('Slack bot listening on port ' + port);
});

//-------------

const SlackClient = require('./ClientRTM')

const slack = SlackClient(process.env.SLACK_TOKEN, process.env.RECONNECT_TIMEOUT_MINUTES);

function sendMessage(channel, message) {
  slack.sendMessage(message, channel).then(reply => {
    console.log('Message sent successfully', reply, reply.ts);
  });
}

// Commands to execute when a message is received
slack.getRTM().on('message', async (message) => {
  const msg = slack.receiveMessage(message);

  // Checks if the message is a message (not an edited, etc) and that the message is to chatbot
  if ((msg.type === 'message') && isDirect(msg.text)) {

    // Check for specified command (apod, help)
    if (msg.command != null) {
      switch (msg.command.toUpperCase()) {
        case 'APOD':
          ProcessOptions(msg.option, msg.argument, msg.channel, msg.user);
          break;
        case 'HELP':
          ProcessOptions(null, msg.argument, msg.channel, msg.user);
          break;
        case 'HI':
        case 'HEY':
        case 'HELLO':
          sendMessage(msg.channel, 'Hi!');
          break;
        default:
          sendMessage(msg.channel, `Invalid command. Please use "@${slack.info.self.name} help" for more information.`);
          break
      }
    } else {
      // Send a brief help message if there was no command
      sendMessage(msg.channel, `Type "@${slack.info.self.name}: help" for usage.`)
    }
  }
});

// Process the options that the user specified
function ProcessOptions(option, argument, channel, user) {
  // Check for specified options
  console.log(option)
  if (option != null) {
    // Check for the 'me' option (DM to user)
    if (option.toUpperCase() === 'ME') {
      slack.getWeb().conversations.open({ users: user }).then(e => {
        Processarguments(argument, e.channel.id, user);
      })
    }
    // Check for the 'us' option (send to the channel the request was maade in)
    else if (option.toUpperCase() === 'US') {
      // Process arguments for the current channel
      Processarguments(argument, channel, user);
    }
    // Check for the 'channel' option (send to the specified channel)
    else if (option.indexOf('#') > -1) {
      // option format is <#CV3HJV0LU|random>
      option = option.substring(2).split('|');
      var message = `Image requested by <@${user}>`;
      Processarguments(argument, option[0], user, message, channel);
    }
    // This should follow
    else if (option.toUpperCase() === 'APOD') {
      ProcessHelp(channel, user);
    } else if (option.toUpperCase() === 'HELP') {
      sendMessage(channel, `help (?,h): Describe the usage of this bot or its subcommands. 
        usage: help [SUBCOMMAND...] (Ex: @${slack.info.self.name} help apod))`)
    } else {
      try {
        message = `Image requested by <@${user}>`;
        sendMessage(channel, message + `Invalid option. Please use "@${slack.info.self.name} help" for more information.`);
      } catch (err) {
        slack.getWeb().conversations.open({ users: user }).then(e => {
          sendMessage(e.channel.id, `Invalid option. Please use "@${slack.info.self.name} help" for more information.`);
        });
      }
    }
  }
  // There are no options, show help
  else {
    ProcessHelpNoDetails(channel, user);
  }
}

// Process the command arguments and display the image
function Processarguments(arg, channel, user, message, channelOriginal) {
  const argument = arg || 'today';
  // If there is no message (undefined), create a blank message
  if (message === undefined) {
    message = '';
  }
  console.log(argument, channel, user, message)
  // APOD Today
  if (argument.toUpperCase() === 'TODAY') {
    loadNewImage(new Date(), channel, user, message, channelOriginal)
  }
  // APOD Yesterday
  else if (argument.toUpperCase() === 'YESTERDAY') {
    var yesterdaysDate = new Date();
    yesterdaysDate = yesterdaysDate.setDate(yesterdaysDate.getDate() - 1);
    loadNewImage(yesterdaysDate, channel, user, message, channelOriginal)
  }
  // APOD random
  else if (argument.toUpperCase() === 'RANDOM') {
    var numberOfDays = CalculateDaysFromFirstImage();
    var randomInt = randomIntFromInterval(1, numberOfDays);
    var randomDate = new Date();
    randomDate = randomDate.setDate(randomDate.getDate() - randomInt);
    loadNewImage(randomDate, channel, user, message, channelOriginal)
  }
  // APOD Date
  else {
    const date = argument.split('-').join('/');
    console.log('date', date, isValidDate(date), channel)
    if (isValidDate(date)) {
      loadNewImage(date, channel, user, message, channelOriginal)
    } else {
      sendMessage(channelOriginal || channel, message + `Invalid argument. Please use "@${slack.info.self.name} help" for more information.`);
    }
  }
}
// Query the URL for a given date
function loadNewImage(date, channel, user, message, channelOriginal) {
  console.log('image to', channel, channelOriginal)
  var formattedDate = formatDate(date);
  message += '\n APOD Image for ' + formattedDate;
  request({
    url: 'https://api.nasa.gov/planetary/apod?concept_tags=false&api_key=' + process.env.NASA_API_TOKEN + '&date=' + formattedDate,
    json: true
  }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      SendToChannelCB(body.url, body.title, body.explanation, formattedDate, channel, user, message, channelOriginal);
    }
  });
}
// Callback function after the JSON has been parsed and we have the URL
function SendToChannelCB(url, title, description, date, channel, user, message, channelOriginal) {
  console.log(url, title, description, date, channel, user, message, channelOriginal)
  try {
    slack.getWeb().chat.postMessage({
      'channel': channel,
      'attachments': [{
        'text': message + '\n' + title + '\n' + description,
        'image_url': url,
        'color': '#FFFFFF',
        'mrkdwn_in': ['text']
      }],
      'username': slack.info.self.name,
      //'icon_url': 'http://i.imgur.com/1ovnJeD.png',
      'unfurl_links': false,
      'unfurl_media': true
    }).catch(e => console.log('after postMessage', e)); //TODO
  } catch (err) {
    sendMessage(channelOriginal || channel, `Invalid channel. Please use "@${slack.info.self.name} help" for more information.`);

  }
}
// Send help message to the specified channel
function ProcessHelp(channel, user) {
  sendMessage(channel, `Help requested by: <@${user}> 
    apod  : Display an Astronomy Picture of the Day image.
    usage  : @${slack.info.self.name} apod {option} {argument}
    Valid options:
        me \t\t \t \t \t \t \t: display the image in a direct message to me.
        us \t \t \t \t \t \t \t: display the image in the current channel or group.
        #channel_name \t: display the image in a specified channel.
    Valid arguments:
        random \t \t \t: display a random day\'s APOD image.
        today \t \t \t \t: display today\'s APOD image.
        yesterday \t \t: display yesterday\'s APOD image.
        {date} \t \t \t \t: displays a specific date\'s APOD image with {date} in the format: MM-DD-YYYY (Ex: 05-25-2006)`);
}

function ProcessHelpNoDetails(channel, user) {
  ProcessHelp(channel, user);
}

// Check if a given date is valid
function isValidDate(str) {
  var matches = str.match(/(\d{1,2})[- . \/](\d{1,2})[- . \/](\d{4})$/);
  if (!matches) return;
  // parse each piece and see if it makes a valid date object
  var month = parseInt(matches[1], 10);
  var day = parseInt(matches[2], 10);
  var year = parseInt(matches[3], 10);
  var date = new Date(year, month - 1, day);
  if (!date || !date.getTime()) return;
  // make sure we have no funny rollovers that the date object sometimes accepts
  // month > 12, day > what's allowed for the month
  if (date.getMonth() + 1 !== month ||
    date.getFullYear() !== year ||
    date.getDate() !== day) {
    return;
  }
  return (date);
}
// Calculate the number of days from the first image (06/16/1996) to today
function CalculateDaysFromFirstImage() {
  var todaysDate = new Date();
  var firstImageDate = new Date('1996', '06', '16');
  var oneDay = 24 * 60 * 60 * 1000; // hours * minutes * seconds * milliseconds
  // (First Date - Second Date) / (one day)
  var dateDifference = Math.round(Math.abs((firstImageDate.getTime() - todaysDate.getTime()) / (oneDay)));
  return dateDifference;
}
// Generate a random number between min and max
function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
// Format a date into the YYYY-MM-DD format
function formatDate(date) {
  var d = new Date(date);
  var month = '' + (d.getMonth() + 1);
  var day = '' + d.getDate();
  var year = d.getFullYear();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [year, month, day].join('-');
}

// Checks if the message was directed at chatbot
function isDirect(text) {
  var userTag = `<@${slack.info.self.id}>`;
  return text &&
    text.length >= userTag.length &&
    text.substr(0, userTag.length) === userTag;
};

(async () => {
  slack.info = await slack.getRTM().start(); //{ self, team }
  // const conversations = await slack.getWeb().conversations.list();
  // showSlackInfo(conversations);
})();
