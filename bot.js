var fs     = require('fs');
var crypto = require('crypto');
var socket = require('socket.io-client')('http://localhost:8080');

var Steam            = require('steam');
var SteamWebLogOn    = require('steam-weblogon');
var getSteamAPIKey   = require('steam-web-api-key');
var SteamTradeOffers = require('steam-tradeoffers');
var SteamCommunity   = require('steamcommunity');
var SteamTotp = require('steam-totp');

var logOnOptions = {
    account_name: 'USERNAME', // your login name
    password: 'PASSWORD' // your login password
};

var keys = {};

logOnOptions['two_factor_code'] = SteamTotp.generateAuthCode('AUTHCODE');
console.log("Using code: " + logOnOptions['two_factor_code']);

if (fs.existsSync('servers')) {
    Steam.servers = JSON.parse(fs.readFileSync('servers'));
}

var steamClient   = new Steam.SteamClient();
var steamUser     = new Steam.SteamUser(steamClient);
var steamFriends  = new Steam.SteamFriends(steamClient);
var steamWebLogOn = new SteamWebLogOn(steamClient, steamUser);
var offers = new SteamTradeOffers();
var logmessages = false;
var logID = "";
var OtherIDToMessage = "";
var sendamessage = false;

steamClient.connect(); // connect to the Steam network
steamClient.on('connected', function() {
    console.log("connected");
    steamUser.logOn(logOnOptions); // login to Steam
});

steamClient.on('logOnResponse', function(logonResp) {
    if (logonResp.eresult == Steam.EResult.OK) {
        console.log('Logged in!');
        steamFriends.setPersonaState(Steam.EPersonaState.LookingToTrade); // set status
        steamFriends.setPersonaName('[Bot #1] 16austin16 Trade Bot'); // change name=

        steamWebLogOn.webLogOn(function(sessionID, newCookie){
            getSteamAPIKey({
                sessionID: sessionID,
                webCookie: newCookie
            }, function(err, APIKey) {
                if (err) throw err;
                offers.setup({
                    sessionID: sessionID,
                    webCookie: newCookie,
                    APIKey: APIKey
                });
            });
        });
    }
});

steamClient.on('servers', function(servers) {
    fs.writeFile('servers', JSON.stringify(servers));
});

steamFriends.on('friend', function (steamID, relationship) {
    console.log("Called onFriend");
    if (relationship == Steam.EFriendRelationship.RequestRecipient) {
        console.log("Friend request received from " + steamID);
        steamFriends.addFriend(steamID);
        console.log("Friend request accepted.");
        steamFriends.sendMessage(steamID, 'Thank you for added me! Do /help to see some commands you can do!', Steam.EChatEntryType.ChatMsg);
    } else if (relationship == Steam.EFriendRelationship.None) {
        console.log(steamID + " Just removed us");
    }
});

steamUser.on('tradeOffers', function(number) {
    if (number > 0) {
        offers.getOffers({
            get_received_offers: 1,
            active_only: 1,
            time_historical_cutoff: Math.round(Date.now() / 1000)
        }, function(err, body) {
            if (err) throw err;
            if (body.response.trade_offers_received) {
                body.response.trade_offers_received.forEach(function(offer) {
                    if (offer.trade_offer_state == 2) {
                        var amount = 0;
                        if (offer.items_to_give === undefined) {
                            offers.acceptOffer({tradeOfferId: offer.tradeofferid});
                            console.log("> Accepting offer sent from " + offer.steamid_other);
                            
                            socket.emit('donation', { 'steamid': offer.steamid_other, 'items': offer.items_to_receive });
                        } else {
                            console.log("> Declining offer sent from " + offer.steamid_other + " - item_to_give is not null");
                            offers.declineOffer({tradeOfferId: offer.tradeofferid});
                        }
                    }
                });
            }
        });
    }
});

steamFriends.on('message', function(source, message, type, chatter) {
    // respond to both chat room and private messages
    if (message != '') {
        console.log("[Message Sent By: 16austin16] " + message);
    }
    if(logmessages){
        if(message!='' && source!=logID)
            steamFriends.sendMessage(logID, "Message From " + source + ": " + message, Steam.EChatEntryType.ChatMsg);
  
    }
    if (sendamessage) {
        if (source == '76561198098597787') {
            if (message == '') {
                return 0;
            }
            steamFriends.sendMessage(OtherIDToMessage, 'Sent By 16austin16: ' + message, Steam.EChatEntryType.ChatMsg);
            steamFriends.sendMessage(source, 'Message Sent.', Steam.EChatEntryType.ChatMsg);
            sendamessage = false;
        }
    }
    if (source == '76561198098597787') {
        if (message == "/logout") {
            process.exit();
        } else if (message == "/state online") {
            steamFriends.setPersonaState(Steam.EPersonaState.Online);
        } else if (message == "/state busy") {
            steamFriends.setPersonaState(Steam.EPersonaState.Busy);
        } else if (message == "/state trade") {
            steamFriends.setPersonaState(Steam.EPersonaState.LookingToTrade);
        }
        if(message == "/authcode") {
            steamFriends.sendMessage(source, 'Code: ' + SteamTotp.generateAuthCode('prTAindU2pNdMC+alCTU81FSTmI='), Steam.EChatEntryType.ChatMsg);
        } else if (message.indexOf("/setname ") > -1) {
            if (message.charAt(0) == '/') {
                var name_start = message.indexOf("me");
                var name = "";
                name_start += 3;
                for (i = name_start; i < message.length; i++) {
                    name += message.charAt(i);
                }
                steamFriends.setPersonaName(name);
            }
        } else if (message == '/logmessages') {
            if (logmessages == true) {
                steamFriends.sendMessage(source, 'Turning Capture Messages off.', Steam.EChatEntryType.ChatMsg);
                logmessages = false;
            } else {
                steamFriends.sendMessage(source, 'Turning Capture Messages on.', Steam.EChatEntryType.ChatMsg);
                logID = source;
                logmessages = true;
            }
        } else if (message == "/help") {
            steamFriends.sendMessage(source, '+++++++++++++++', Steam.EChatEntryType.ChatMsg);
            steamFriends.sendMessage(source, '+++16austin16\'s+++', Steam.EChatEntryType.ChatMsg);
            steamFriends.sendMessage(source, '++++++Bot++++++', Steam.EChatEntryType.ChatMsg);
            steamFriends.sendMessage(source, '+++++++++++++++', Steam.EChatEntryType.ChatMsg);
            steamFriends.sendMessage(source, '/steamid', Steam.EChatEntryType.ChatMsg);
            steamFriends.sendMessage(source, '/website', Steam.EChatEntryType.ChatMsg);
        } else if (message == "/steamid") {
            steamFriends.sendMessage(source, 'Your Steam ID Is ' + source, Steam.EChatEntryType.ChatMsg);
        } else if (message == "/website") {
            steamFriends.sendMessage(source, 'The Website Is http://csgo.chalkcraftserver.xyz', Steam.EChatEntryType.ChatMsg);
        } else if (message.indexOf("/sendmsg ") > -1) {
            if (message.charAt(0) == '/') {
                steamFriends.sendMessage(source, 'Type message:', Steam.EChatEntryType.ChatMsg);
                var string_start = message.indexOf("sg");
                var recive_ID = "";
                string_start += 3;
                for (i = string_start; i < message.length; i++) {
                    recive_ID += message.charAt(i);
                }
                sendamessage = true;
                OtherIDToMessage = recive_ID;
            }
        }
    } else {
        if (message != '') {
            console.log("[Message Sent By: " + source + "] " + message);
        }
        if (message == "/help") {
            steamFriends.sendMessage(source, '++++++++++++++', Steam.EChatEntryType.ChatMsg);
            steamFriends.sendMessage(source, '+16austin16\'s+', Steam.EChatEntryType.ChatMsg);
            steamFriends.sendMessage(source, '+++++Bot+++++', Steam.EChatEntryType.ChatMsg);
            steamFriends.sendMessage(source, '++++++++++++++', Steam.EChatEntryType.ChatMsg);
            steamFriends.sendMessage(source, '/steamid', Steam.EChatEntryType.ChatMsg);
            steamFriends.sendMessage(source, '/website', Steam.EChatEntryType.ChatMsg);
        } else if (message == "/steamid") {
            steamFriends.sendMessage(source, 'Your Steam ID Is ' + source, Steam.EChatEntryType.ChatMsg);
        } else if (message == "/website") {
            steamFriends.sendMessage(source, 'The Website Is http://csgo.chalkcraftserver.xyz', Steam.EChatEntryType.ChatMsg);
        }
    }
});