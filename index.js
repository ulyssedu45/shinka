import 'dotenv/config'
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Client, GatewayIntentBits, Partials, REST, Routes, PermissionFlagsBits, ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } from "discord.js";
import { Configuration, OpenAIApi } from "openai";

import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

import RandomOrg from 'random-org';
import { Server } from "socket.io";

const io = new Server(10000);
var avaliableLlama = new Array();

io.on("connection", (socket) => {
    if(socket.handshake.query.ia_type != undefined){
        if(socket.handshake.query.ia_type == "llama"){
            avaliableLlama.push(socket);
            console.log("llama+");
        }
    }

    socket.on("disconnect", (reason) => {
        avaliableLlama.splice(avaliableLlama.indexOf(socket), 1);
        console.log("llama-");
    });
});

const DEFAULT_PROMPT = "Dans cette univers tu es Shinka, shion1746 est la déesse de cette univers, yoimiyaaaaa est une tortue communiste, ulyssedu45 est le grand administrateur, Le_petit_paradox est le gardien de garderie, Blank et ulyssedu45 sont tes createurs, 412 et 41242702031 sont des alias de Blank et tu es la pour aider les gens."

const random = new RandomOrg({ apiKey: '67be6062-b728-4073-8f9f-56c4d4f9182b' });
var randomSeed = 0;
var rand = function() { return 0;};

const MAX_LENGTH = 25;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildMessageTyping, GatewayIntentBits.DirectMessages, GatewayIntentBits.DirectMessageTyping,  GatewayIntentBits.DirectMessageReactions], partials: [Partials.Channel] });
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const regex_user = /<@[0-9]{2,32}>/g;
const regex_groupe = /<@&[0-9]{2,32}>/g;
const regex_channel = /<#[0-9]{2,32}>/g;
const regex_emojis = /(<a?)?:\w+:(\d{2,32}>)?/g;

const configuration = new Configuration({
    organization: process.env.OPENIA_ORGANIZATION,
    apiKey: process.env.OPENIA_APIKEY,
});
const openai = new OpenAIApi(configuration);

var guildsDatabaseMap = new Map();
var guildsQueueMap = new Map();
var guildsBusyMap = new Map();
var guildsTypingIntervalMap = new Map();

var usersDatabaseMap = new Map();
var usersQueueMap = new Map();
var usersBusyMap = new Map();
var usersTypingIntervalMap = new Map();

var commandsMap = new Map();
var commandsArray = new Array();

try {
    if (!fs.existsSync(path.join(__dirname, "data"))) {
      fs.mkdirSync(path.join(__dirname, "data"));
    }
    if (!fs.existsSync(path.join(__dirname, "data", "guilds"))) {
        fs.mkdirSync(path.join(__dirname, "data", "guilds"));
    }
    if (!fs.existsSync(path.join(__dirname, "data", "users"))) {
        fs.mkdirSync(path.join(__dirname, "data", "users"));
    }
} catch (err) {
    console.error(err);
}

async function loadCommandsFiles(){

    var files = fs.readdirSync(path.join(__dirname, "commands"));


    for(const file of files){
        const module = await import('./commands/' + file);
        commandsMap.set(module.name, module);
        commandsArray.push(module.data.toJSON());
    }
}

async function startREST(){

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENTID), { body: commandsArray });

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }

}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log("change this part");
});
    
client.on('interactionCreate', async interaction => {
    try {
        var isAdmin = null;
        var databaseID = null;
        var databaseMap = guildsDatabaseMap;

        if(interaction.guildId == null){
            isAdmin = true;
            databaseID = interaction.user.id;
            databaseMap = usersDatabaseMap;
        }else{
            isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            databaseID = interaction.guildId;
        }

        if (interaction.isChatInputCommand()){
            if (interaction.commandName === 'reset_history' && isAdmin) {
                commandsMap.get('reset_history').execute(interaction, databaseMap, databaseID, checkDatabase);
            }else if (interaction.commandName === 'reset_prompt' && isAdmin) {
                commandsMap.get('reset_prompt').execute(interaction, databaseMap, databaseID, checkDatabase);
            }else if (interaction.commandName === 'set_prompt' && isAdmin) {
                commandsMap.get('set_prompt').execute(interaction);
            }else if(interaction.commandName === 'show_running_data' && (interaction.user.id == "706922230579200041" || interaction.user.id == "807307227366555699")){
                commandsMap.get('show_running_data').execute(interaction, randomSeed);
            }else{
                await interaction.reply('Erreur');
            }
        }else if (interaction.isModalSubmit()){
            if(interaction.customId == "modalChangePrompt" && isAdmin){
                await checkDatabase(databaseMap, databaseID, interaction.guildId == null);

                await databaseMap.get(databaseID).read();
                databaseMap.get(databaseID).data.prompt = interaction.fields.fields.get("prompt_data_input").value;
                databaseMap.get(databaseID).data.messages = new Array();
                await databaseMap.get(databaseID).write();

                await interaction.reply('Ma personnalité a bien été changée.');
            }
        }
    } catch (error) {
        console.error(error);
    }
});

client.on('messageCreate', async message => {
    try {
        if (message.partial) {
            // Never triggers
            console.log(`Received partial message- ${message.id}`);
            return;
        }

        try {
            if(message.author.id == client.user.id){
                return;
            }else if(message.mentions.has(client.user.id, {ignoreEveryone: true}) || !message.inGuild() || message.content.toLowerCase().includes("shinka")){
                var content = message.content;
                var guild = message.guild;

                var found_users = content.match(regex_user);
                var found_groupe = content.match(regex_groupe);
                var found_channel = content.match(regex_channel);
                var found_emojis = content.match(regex_emojis);
                
                var usernameMap = new Map();
                usernameMap.set(message.author.username, "<@" + message.author.id + ">");

                if(Array.isArray(found_users)){
                    for (const user of found_users) {
                        let userData = await client.users.fetch(user.replace('<@', '').replace('>', ''));
                        content = content.replace(user, userData.username);
                        usernameMap.set(userData.username, user);
                    }
                }
                if(message.inGuild()){
                    if(Array.isArray(found_groupe)){
                        for (const groupe of found_groupe) {
                            content = content.replace(groupe, guild.roles.resolve(groupe.replace('<@&', '').replace('>', '')).name);
                        }
                    }
                    if(Array.isArray(found_channel)){
                        for (const channel of found_channel) {
                            let channelData = await client.channels.fetch(channel.replace('<#', '').replace('>', ''));
                            content = content.replace(channel, channelData.name);
                        }
                    }
                }
                if(Array.isArray(found_emojis)){
                    for (const emoji of found_emojis) {
                        content = content.replace(emoji, "");
                    }
                }
                
                content = content.replace(/\s+/g, ' ').trim();

                if(content.length === 0){
                    return;
                }

                content = message.author.username + " te dit : \"" + content + "\"";

                var databaseID = null;
                var queueMap = null;

                if(!message.inGuild()){
                    databaseID = message.author.id;
                    queueMap = usersQueueMap;
                }else{
                    databaseID = message.guildId;
                    queueMap = guildsQueueMap;
                }

                if(!queueMap.has(databaseID)){
                    queueMap.set(databaseID, new Array());
                }

                queueMap.get(databaseID).push({message: message, content: content, databaseID: databaseID, isDM: !message.inGuild(), selfReply: false, usernameMap: usernameMap});
            }else if(getRandomInt(1000) >= 950 && message.inGuild() && !message.author.bot){
                var content = message.content;
                var guild = message.guild;

                var found_users = content.match(regex_user);
                var found_groupe = content.match(regex_groupe);
                var found_channel = content.match(regex_channel);
                var found_emojis = content.match(regex_emojis);
                
                var usernameMap = new Map();
                usernameMap.set(message.author.username, "<@" + message.author.id + ">");

                if(Array.isArray(found_users)){
                    for (const user of found_users) {
                        let userData = await client.users.fetch(user.replace('<@', '').replace('>', ''));
                        content = content.replace(user, userData.username);
                        usernameMap.set(userData.username, user);
                    }
                }
                if(Array.isArray(found_groupe)){
                    for (const groupe of found_groupe) {
                        content = content.replace(groupe, guild.roles.resolve(groupe.replace('<@&', '').replace('>', '')).name);
                    }
                }
                if(Array.isArray(found_channel)){
                    for (const channel of found_channel) {
                        let channelData = await client.channels.fetch(channel.replace('<#', '').replace('>', ''));
                        content = content.replace(channel, channelData.name);
                    }
                }
                if(Array.isArray(found_emojis)){
                    for (const emoji of found_emojis) {
                        content = content.replace(emoji, "");
                    }
                }
                
                content = content.replace(/\s+/g, ' ').trim();

                if(content.length === 0){
                    return;
                }

                content = "Tu viens te lire un message dans un discussion qui a été envoyé par " + message.author.username + " et tu veux y répondre (tu dois répondre de façon familière), voici le message : \"" + content + "\"";

                var databaseID = null;
                var queueMap = null;

                if(!message.inGuild()){
                    databaseID = message.author.id;
                    queueMap = usersQueueMap;
                }else{
                    databaseID = message.guildId;
                    queueMap = guildsQueueMap;
                }

                if(!queueMap.has(databaseID)){
                    queueMap.set(databaseID, new Array());
                }

                queueMap.get(databaseID).push({message: message, content: content, databaseID: databaseID, isDM: !message.inGuild(), selfReply: true, usernameMap: usernameMap});
            }
        
        } catch (error) {
            console.error(error);
        }
    
    } catch (error) {
        console.error(error);
    }
})

async function runIA(message, content, databaseID, isDM, selfReply, usernameMap, retry = 0, llama = false){
    var busyMap = null;
    var databaseMap = null;
    var typingIntervalMap = null;

    if(isDM){
        busyMap = usersBusyMap;
        databaseMap = usersDatabaseMap;
        typingIntervalMap = usersTypingIntervalMap;
    }else{
        busyMap = guildsBusyMap;
        databaseMap = guildsDatabaseMap;
        typingIntervalMap = guildsTypingIntervalMap;
    }

    busyMap.set(databaseID, true);

    try{
        sendTyping(message.channel);

        if(typingIntervalMap.has(databaseID)){
            clearInterval(typingIntervalMap.get(databaseID));
            typingIntervalMap.delete(databaseID)
        }

        typingIntervalMap.set(databaseID, setInterval(() => {
            try{
                sendTyping(message.channel);
            } catch (err) {
                console.error(err);
            }
        }, 1000));

        await checkDatabase(databaseMap, databaseID, isDM);
        await databaseMap.get(databaseID).read();
        
        var iaData = new Array();

        iaData.push({role: "system", content: databaseMap.get(databaseID).data.prompt});
        for (const element of databaseMap.get(databaseID).data.messages) {
            iaData.push(element);
        }
        iaData.push({role: (selfReply ? 'system' : 'user'), content: content});
        
        var finalContent = null
        var finalMessage = null
        if(!llama){
            const chatCompletion = await openai.createChatCompletion({
                model: "gpt-3.5-turbo-16k",
                messages: iaData,
            });

            finalMessage = chatCompletion.data.choices[0].message;
        }else{
            if(avaliableLlama.length > 0){
                var textData = null
                textData = await new Promise(async resolve => {
                    var currentSocket = avaliableLlama[0];
                    currentSocket.emit("request", iaData, async (ack) => {
                        resolve(ack); // ok
                    });

                    while(textData == null){
                        if(!currentSocket.connected){
                            resolve(false);
                        }
                        await delay(1000);
                    }
                    
                });

                if(textData){
                    finalMessage = {role: "assistant", content: textData}
                }else{
                    throw new Error("erreur serveur");
                }
                
            }else{
                if(typingIntervalMap.has(databaseID)){
                    clearInterval(typingIntervalMap.get(databaseID));
                    typingIntervalMap.delete(databaseID)
                }

                busyMap.set(databaseID, false);
                return;
            }

            finalMessage = {role: "assistant", content: textData}
        }

        finalContent = finalMessage.content;

        for (const [key, value] of usernameMap) {
            finalContent = finalContent.replaceAll(key, value);

            var searchMask = key;
            var regEx = new RegExp(searchMask, "ig");
            var replaceMask = value;

            finalContent = finalContent.replace(regEx, replaceMask);
        }

        const [first, ...rest] = splitMessage(finalContent, { maxLength: 2000 })

        if(typingIntervalMap.has(databaseID)){
            clearInterval(typingIntervalMap.get(databaseID));
            typingIntervalMap.delete(databaseID)
        }

        if (rest.length == 0) {
            message.channel.send(finalContent)
        }else{
            await message.channel.send(first)
            for (const text of rest) {
                await message.channel.send(text)
            }
        }
        

        //Sauv de l'echange
        databaseMap.get(databaseID).data.messages.push({role: (selfReply ? 'system' : 'user'), content: content})
            
        if(databaseMap.get(databaseID).data.messages.length > MAX_LENGTH * 2){
            databaseMap.get(databaseID).data.messages.shift();
        }

        databaseMap.get(databaseID).data.messages.push(finalMessage)

        if(databaseMap.get(databaseID).data.messages.length > MAX_LENGTH * 2){
            databaseMap.get(databaseID).data.messages.shift();
        }

        await databaseMap.get(databaseID).write();
    } catch (error) {
        if(retry > 0){
            await message.reply('Erreur');
            busyMap.set(databaseID, false);
            return;
        }

        if(!llama && error.response.status){
            busyMap.set(databaseID, false);
            runIA(message, content, databaseID, isDM, selfReply, usernameMap, retry, true);

            await delay(500);

            return;
        }else{
            await checkDatabase(databaseMap, databaseID, isDM);
                
            await databaseMap.get(databaseID).read();
            databaseMap.get(databaseID).data.messages = new Array();
            await databaseMap.get(databaseID).write();
    
            await message.reply('Erreur, ma mémoire a du être réinitialisée.');
    
            busyMap.set(databaseID, false);

            runIA(message, content, databaseID, isDM, selfReply, usernameMap, retry++, llama);
            
            await delay(500);

            return;
        }
    }

    busyMap.set(databaseID, false);
}

function runMainTask(){
    try {
        for (const [key, value] of guildsQueueMap) {
            if (value.length>0) {
                if(guildsBusyMap.has(value[0].databaseID)){
                    if(!guildsBusyMap.get(value[0].databaseID)){
                        runIA(value[0].message, value[0].content, value[0].databaseID, value[0].isDM, value[0].selfReply, value[0].usernameMap);
                        value.shift();
                    }
                }else{
                    runIA(value[0].message, value[0].content, value[0].databaseID, value[0].isDM, value[0].selfReply, value[0].usernameMap);
                    value.shift();
                }
            }
        }
        
        for (const [key, value] of usersQueueMap) {
            if (value.length>0) {
                if(usersBusyMap.has(value[0].databaseID)){
                    if(!usersBusyMap.get(value[0].databaseID)){
                        runIA(value[0].message, value[0].content, value[0].databaseID, value[0].isDM, value[0].selfReply, value[0].usernameMap);
                        value.shift();
                    }
                }else{
                    runIA(value[0].message, value[0].content, value[0].databaseID, value[0].isDM, value[0].selfReply, value[0].usernameMap);
                    value.shift();
                }
            }
        }
    } catch (error) {
        console.error(error);
    }
    
}



async function checkDatabase(databaseMap, databaseID, isDM){
    if(!databaseMap.has(databaseID)){
        var subfolder = (isDM ? 'users' : 'guilds');
        const adapter = new JSONFile(path.join(__dirname, "data", subfolder, databaseID + ".json"));
        const defaultData = { prompt : DEFAULT_PROMPT, messages: [] };
        databaseMap.set(databaseID, new Low(adapter, defaultData));
        await databaseMap.get(databaseID).read();
        await databaseMap.get(databaseID).write();
    }
}



async function start(){

    await loadCommandsFiles();

    var randomData = await random.generateUUIDs({n: 1 });
    randomSeed = cyrb128(randomData.random.data[0]);
    rand = sfc32(randomSeed[0], randomSeed[1], randomSeed[2], randomSeed[3]);

    setInterval(runMainTask, 100);

    await startREST();
    await client.login(process.env.DISCORD_TOKEN);
};

start();

// UTILS

const delay = (delayInms) => {
    return new Promise(resolve => setTimeout(resolve, delayInms));
}

// Autre Fonction

async function sendTyping(channel){
    try{
        channel.sendTyping()
    }catch (error){
        console.error(error)
    }
}

function splitMessage(text, { maxLength = 2_000, char = '\n', prepend = '', append = '' } = {}) {
    text = verifyString(text);
    if (text.length <= maxLength) return [text];
    let splitText = [text];
    if (Array.isArray(char)) {
      while (char.length > 0 && splitText.some(elem => elem.length > maxLength)) {
        const currentChar = char.shift();
        if (currentChar instanceof RegExp) {
          splitText = splitText.flatMap(chunk => chunk.match(currentChar));
        } else {
          splitText = splitText.flatMap(chunk => chunk.split(currentChar));
        }
      }
    } else {
      splitText = text.split(char);
    }
    if (splitText.some(elem => elem.length > maxLength)) throw new RangeError('SPLIT_MAX_LEN');
    const messages = [];
    let msg = '';
    for (const chunk of splitText) {
      if (msg && (msg + char + chunk + append).length > maxLength) {
        messages.push(msg + append);
        msg = prepend;
      }
      msg += (msg && msg !== prepend ? char : '') + chunk;
    }
    return messages.concat(msg).filter(m => m);
}

function verifyString(data, error = Error, errorMessage = `Expected a string, got ${data} instead.`, allowEmpty = true) {
    if (typeof data !== 'string') throw new error(errorMessage);
    if (!allowEmpty && data.length === 0) throw new error(errorMessage);
    return data;
}

// RANDOM

function getRandomInt(max) {
    return Math.floor(rand() * max);
}

function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277,
        h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4), h2 ^= h1, h3 ^= h1, h4 ^= h1;
    return [h1>>>0, h2>>>0, h3>>>0, h4>>>0];
}

function sfc32(a, b, c, d) {
    return function() {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
      var t = (a + b) | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      d = d + 1 | 0;
      t = t + d | 0;
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
}