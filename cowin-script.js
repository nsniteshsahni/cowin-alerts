const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const TelegramBot = require("node-telegram-bot-api");

var age18 = false
var pinCode = process.env.PINCODE
var alerts = 0;
var token = process.env.TOKEN
var interval = 10; // seconds
var intervalID;
var remainingTime = 10;
var fetchIntervalId;
var running = false;
vaccineFilter = false
var vaccine = "COVAXIN"

var centerAddresses = ["DGD Sector-8 Rohini Delhi", "Sec.5 Rohini, Near Post Office", "A-3 Block, Sector-4 Rohini"]
var centerPreferenceNotRequired = true
const recheck = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

if (!token) {
    console.log("No Bot Token given, exiting!!!");
    process.exit(1);
}

if (!pinCode) {
    pinCode = 110085
    console.log("No pincode specified, using the default: " + pinCode);
}

function getDate() {
    const d = new Date();
    var month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();
    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [day, month, year].join('-');
}

function getAge() {
    return age18 ? 18 : 45;
}

const bot = new TelegramBot(token, { polling: true });
//The place where actual magic begins
check()

bot.on("message", async (msg) => {
    var text = msg.text;
    if (text == "start") {
        alerts = 0;
    }
    else if (text == "kill") {
        // That means something went wrong, kill the bot.
        process.exit(1);
    }
});

function check() {
    if (running) { // Stop
        clearInterval(intervalID)
        clearInterval(fetchIntervalId)
    } else { // Start
        checkerForPin()
        intervalID = setInterval(checkerForPin, interval * 1000)
        fetchIntervalId = setInterval(() => {
            console.log('Fetching the slots in ' + remainingTime--);
        }, 1000)
    }
    running = !running;
}

function getByPincode(callback) {
    var req = new XMLHttpRequest();
    const date = getDate();
    const url = `https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin?pincode=${pinCode}&date=${date}`;
    console.log("Requesting CoWin API for vaccine slots");
    req.open('GET', url, true);
    req.responseType = 'json';
    req.onload = function () {
        var status = req.status;
        if (status === 200)
            callback(null, req.responseText);
        else
            callback(status, req.responseText);
    };
    req.send();
}


async function checkerForPin() {
    getByPincode(async (err, res) => {
        if (err) return console.log(`Error: ${err}`)
        const age = getAge();
        let count = 0;
        res = JSON.parse(res)
        console.log(res);
        const available = res.centers.filter(center => {
            if (centerPreferenceNotRequired || centerAddresses.includes(center.address)) {
                count += center.sessions[0].min_age_limit === age;
                return center.sessions.some(s => (s.available_capacity > 0 && s.min_age_limit === age))
            }
        });
        console.log(available);
        await recheck(500)
        if (available.length != 0) {
            sendAlert(available);
        }
        remainingTime = interval - 1;

    })
}

function sendAlert(available) {
    // Send only the first alert
    if (alerts > 0) return;
    // Send Message to Telegram
    console.log('Found available slots!')
    sendMessageToChannel(available);
    alerts++
}

function sendMessageToChannel(available) {
    available.forEach((element) => {
        setTimeout(() =>{
            var sessions = []
            element.sessions.forEach(session => {
                sessions.push({ date: session.date, min_age_limit: session.min_age_limit ,available_capacity: session.available_capacity, vaccine: session.vaccine });
            })
            sessions = vaccineFilter ? sessions.filter(session => session.vaccine === vaccine) : sessions
            let slot = { name: element.name, address: element.address, sessions: sessions.length!=0 ? sessions : "No "+ vaccine +" vaccine at this center" }
            if (!(slot.sessions === "No eligible vaccine at this center")) { 
               console.log(prettyPrintSlot(slot)); 
               bot.sendMessage("@deathstrokens", prettyPrintSlot(slot));
               console.log("Sent message to Telegram!!!!");
            }
        }, 100)
    });
}
let finalString

function prettyPrintSlot(slot){
    slotData = ""
    slotData += "Name: " + slot.name;
    slotData += "\nAddress: " + slot.address;
    slotData += "\nCalendar\n---------------------";
    for (let index = 0; index < slot.sessions.length; index++) {
        slotData += getSessions(slot.sessions[index]);
    }
    return slotData;
}

function getSessions(session) { 
    var string = ""
    finalString = ""
    string+= "\nDate: "+ session.date;
    string+= "\nMinimum Age: " + session.min_age_limit;
    string+= "\nSlots available: " + session.available_capacity;
    string+= "\nVaccine: " + session.vaccine+"\n---------------------"
    return string;
    
}


