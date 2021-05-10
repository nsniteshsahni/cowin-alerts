const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const TelegramBot = require("node-telegram-bot-api");

var age18 = false
var pinCode = process.env.PINCODE || 110085
var alerts = 0;
var token =  process.env.TOKEN
var interval = 10; // seconds
var intervalID;
var remainingTime = 10;
var fetchIntervalId;
var running = false;
vaccineFilter = true
var vaccine = "COVAXIN"

var centerAddresses = ["DGD Sector-8 Rohini Delhi", "Sec.5 Rohini, Near Post Office", "A-3 Block, Sector-4 Rohini"]

const recheck = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

if(!token){
  console.log("No Bot Token given, exiting!!!");
  process.exit(1);
}

if(!pinCode){
    console.log("No pincode specified, using the default: "+ pinCode);
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
if(text == "start"){
     alerts = 0;
 }
 else if(text == "kill"){
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
            console.log( 'Fetching the slots in ' + remainingTime--);
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
    req.onload = function() {
        var status = req.status;
        if (status === 200)
            callback(null, req.responseText);
        else
            callback(status, req.responseText);
    };
    req.send();
}


async function checkerForPin(){
    getByPincode(async (err, res) =>{
        if (err) return console.log(`Error: ${err}`)
        const age = getAge();
        let count = 0;
        res = JSON.parse(res)
        console.log(res);
        const available = res.centers.filter(center => {
            if(centerAddresses.includes(center.address)){
            count += center.sessions[0].min_age_limit === age;
            return center.sessions.some(s => (s.available_capacity > 0 && s.min_age_limit === age))}
        });
        console.log(available);
        await recheck(500)
        if(available.length!=0) {
            sendAlert(available);
        }
        remainingTime = interval - 1;

    })
}

function sendAlert(available) {
    // Send only the first alert
    if (alerts > 0) return;
    // Send Message to Telegram
    sendMessageToChannel(available);
    console.log('Found available slots!')
    alerts ++
}

function sendMessageToChannel(available){
    available.forEach(element => {
        var sessions = []
        element.sessions.forEach(session => {
           sessions.push({date:session.date, available_capacity: session.available_capacity, vaccine: session.vaccine});
        })
        sessions = vaccineFilter ? sessions.some(session => session.vaccine === vaccine): sessions
        let slot = {name : element.name, address: element.address, sessions: sessions?sessions:"No eligible vaccine at this center"}
        if(!(slot.sessions === "No eligible vaccine at this center"))
           bot.sendMessage("@deathstrokens", JSON.stringify(slot, null, 2));
           console.log("Sent message to Telegram!!!!");
        });        
}
