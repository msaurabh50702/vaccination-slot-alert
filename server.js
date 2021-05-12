const express = require("express")
const bodyParser = require('body-parser')
const https = require('https');
const TelegramBot = require('node-telegram-bot-api');
const { Keyboard,Key } = require('telegram-keyboard')
const axios = require('axios');
const tunnel = require('tunnel');

require("dotenv").config()

const bot = new TelegramBot(process.env.tokens, {polling: true});
const app = express()
const db = require("./initDB")
const { user,appn } = require("./schema");
const { now } = require("mongoose");


app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const states = require("./states.json")
let users = {}
let zip = ['423109','423601', '423607']
let ListOfDistricts = ['Ahmednagar']

let max_err_cnt = 4
let cr_err_cnt = 0
let cr_host = process.env.PROXY_HOST
let cr_port = process.env.PROXY_PORT

let b_host = "14.140.31.28"
let b_port = 3128


async function fetchData(url) {
    return new Promise((resolve, reject) => {
      const request = https.get(url,{headers: {
             userAgent: "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36"
        } }, (res) => {
        if (res.statusCode < 200 || res.statusCode > 299) {
          return reject(new Error(`HTTP status code ${res.statusCode}`))
        }
  
        const body = []
        res.on('data', (chunk) => body.push(chunk))
        res.on('end', () => {
          const resString = Buffer.concat(body).toString()
          resolve(JSON.parse(resString))
        })
      })
      request.on('error', (err) => {
        reject(err)
      })
      request.on('timeout', () => {
        request.destroy()
        reject(new Error('timed out'))
      })
    })
}

async function fetchData1(url) {
    const agent = tunnel.httpsOverHttp({
        proxy: {
            host: cr_host,
            port: cr_port,
        },
    });
    return axios.get(url,{ headers: { 
                                'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1'
                             },
                             httpsAgent: agent,
                    })
}

const answerCallbacks = {};

bot.on("message", function(msg) {
  const callback = answerCallbacks[msg.chat.id];
  if (callback) {
    delete answerCallbacks[msg.chat.id];
    return callback(msg);
  }
});

const askQuestion = async (chatId, question) => {
  await bot.sendMessage(chatId, question);
  return new Promise(fullfill => {
    answerCallbacks[chatId] = msg => {
      if (msg.text[0] !== "/") {
        fullfill(msg);
      }
    };
  });
};

const deleteObj = (data, column, search) => {
    let result = data.filter(m => m[column] !== search);
    return result;
}

const getObj = (data, column, search) => {
    console.log(data)
    let result = data.filter(m => m[column] == search);
    return result;
}
const sendNotification = async (chat_id,slot) => {
    await bot.sendMessage(chat_id,"send msg",{parse_mode:"HTML"})
}

const getIdByKey = (key) => {
    for (const state in states) {
        try {
            if(states[state][key] !== undefined)
                return states[state][key]
        } catch (error) {
            continue
        }
    }
}

const action = (stt)=>{
    console.log(stt)
}

const getStates = ()=>{
    st = []
    for (const state in states) {
        st.push(Key.callback(state, state))
    }
    return st;
}

const getDist = (stat)=>{
    dst = []
    for(const d in states[stat])
        dst.push(Key.callback(d,d))
    return dst;
}

const updateZipArray = (opn) =>{
    if(opn.operation == "Add"){
        zip.indexOf(opn.code) === -1 && zip.push(opn.code);
    }
    else if(opn.operation == "Del"){
        var index = zip.indexOf(opn.code);
        if (index !== -1) {
            zip.splice(index, 1);
        }
    }
    console.log("Zip : "+zip)
}
const updateDisAppay = (opn)=>{
    if(opn.operation == "Add"){
        ListOfDistricts.indexOf(opn.code) === -1 && ListOfDistricts.push(opn.code);
    }
    else if(opn.operation == "Del"){
        var index = ListOfDistricts.indexOf(opn.code);
        if (index !== -1) {
            ListOfDistricts.splice(index, 1);
        }
    }
    console.log("Dist : "+ListOfDistricts)
}

const slotBooked = (c_id,pin,msg_id) =>{
    user.findOne({chat_id:c_id}).then(doc => {
        if(doc == null) throw "Unauthorised Access"
        else{
            doc['appl'] = deleteObj(doc['appl'], 'pin', Number(pin));
            doc.save().then(data =>{
                user.findOne({'appl.pin':Number(pin)}).then(rem =>{
                    if(rem == null){
                        var index = zip.indexOf(pin);
                        if (index !== -1) {
                            zip.splice(index, 1);
                        }
                    }
                })
            });      
            bot.sendMessage(c_id,"Now <strong>"+pin+"</strong> Removed from your Tracking List",{parse_mode : "HTML"}).then(()=>{
               // bot.editMessageReplyMarkup(msg_id,{reply_markup:null})
                //bot.editMessageReplyMarkup("hello",{message_id:msg_id,chat_id:c_id,reply_markup:{remove_keyboard:true}})
                bot.deleteMessage(c_id,msg_id)
            })
            zip.indexOf(pin) === -1 && zip.push(pin);
        }
    }).catch(err => {
        console.log('Oh! Dark'+err)
        if(err === "Unauthorised Access")
            bot.sendMessage(msg.chat.id,"Invalid Invitation code")
        else
            bot.sendMessage("Something went wrong\n<b>Can't set your Tracker</b>",{parse_mode:"HTML"})
    });
}


bot.on("callback_query", function onCallbackQuery(callbackQuery) {
    if(callbackQuery.message.text == 'Please Select Your State'){
        bot.deleteMessage(callbackQuery.from.id,callbackQuery.message.message_id)
        const keyboard1 = Keyboard.make(getDist(callbackQuery.data), {
            pattern: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
        }).inline()
        bot.sendMessage(callbackQuery.from.id,"Please Select Your District",keyboard1).then(data =>{
            user.findOneAndUpdate({chat_id:callbackQuery.from.id}, {state:callbackQuery.data}, function(err, doc) {
                if (err) console.log("State Updation Failed");
            });
        })
    }
    else if(callbackQuery.message.text == 'Please Select Your District'){
        bot.deleteMessage(callbackQuery.from.id,callbackQuery.message.message_id)
        bot.sendMessage(callbackQuery.from.id,"You Selected : <b>"+callbackQuery.data+"</b>",{parse_mode:"HTML"})
        user.findOneAndUpdate({chat_id:callbackQuery.from.id}, {district:callbackQuery.data}, function(err, doc) {
            if (err) console.log("District Updation Failed");
        });
    }
    else{
        if(callbackQuery.data.split(":")[0]=="Booked"){
            slotBooked(callbackQuery.from.id,callbackQuery.data.split(":")[1],callbackQuery.message.message_id)
            console.log("Slot Booked")
        }
        else
            console.log(callbackQuery)
    }
});

bot.onText(/\/start/, async (msg, match) => {
    console.log("Access Requested : "+msg.chat.first_name+" "+msg.chat.last_name)
    user.findOne({chat_id:msg.chat.id},async (err,data)=>{
        try{
            if(err) throw err;
            else{
                if(data == null){
                    //bot.sendMessage(process.env.MY_CHAT_ID,"Access Requested By :- "+msg.chat.first_name+" "+msg.chat.last_name)
                    code = await askQuestion(msg.chat.id, 'Enter Your Invitation Code :')
                    if(code['text'] === process.env.invi){
                        let col = new user({
                            name: msg.chat.first_name,
                            state : "",
                            district : "",
                            chat_id: msg.chat.id,
                            paused: 0,
                            pin:{},
                            accVerified:1
                        })
                        let resp = null;
                        col.save(async(err,data)=>{
                            if(await err){
                                console.log("DB ERROR",err)
                                resp = "Something went wrong";
                                bot.sendMessage(msg.chat.id, resp);
                            } 
                            else{
                                resp = "Hello "+msg.chat.first_name+",\n\nI am cowin_slot_tracker, I can track 'Vaccination Slot Availability' in your area once it is available i will notify you...!\n\nPlease use \/help to know more"; 
                                bot.sendMessage(msg.chat.id, resp).then(()=>{
                                    const keyboard = Keyboard.make(getStates(), {
                                        pattern: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
                                    }).inline()
                                    bot.sendMessage(msg.chat.id,"Please Select Your State",keyboard)
                                });
                            }
                        });
                    }
                    else{
                        bot.sendMessage(msg.chat.id,"Invalid Invitation Code : ")
                    } 
                }
                else{
                    resp = "Welcome Back "+msg.chat.first_name+",\n\nI am cowin_slot_tracker, I can track 'Vaccination Slot Availability' in your area once it is available i will notify you...!\n\nPlease use \/help to know more"; 
                    bot.sendMessage(msg.chat.id,resp)
                }
            }
        }catch(e){
            console.log("Error in /Start -> ",err)
        }
    })
    
});

bot.onText(/\/setTracker/,async (msg,match)=>{
    let name,age,pin;
    user.findOne({chat_id:msg.chat.id}).then(async (doc) => {
        if(doc == null) throw "Unauthorised Access"
        else{
            pin = await askQuestion(msg.chat.id, 'Enter Your Pincode')
            name = await askQuestion(msg.chat.id, 'Enter Name')
            age = await askQuestion(msg.chat.id, 'Enter age')

            data = { 
                a_name:name['text'],
                a_age:age['text'], 
                pin:pin['text'],
                vaccinated:0
            }
            doc['appl'].forEach(element => {
                if(element.a_age <= age['text'] && element.pin == pin['text'])
                    throw "Duplicate Found"
            });
            item = doc['appl'].push(data);
            doc.save();  
            ms = "<b>    Name : </b>"+ name['text']+"\n<b>    Age : </b>"+age['text']+"\n<b>    Pincode : </b>"+pin['text'];     
            bot.sendMessage(msg.chat.id,"Hey, "+doc['name']+'\nI got your request and now you will get message once slot available \n\n<b>Details : </b>\n'+ms,{parse_mode : "HTML"})
            updateZipArray({operation:"Add",code:pin['text']})
            updateDisAppay({operation:"Add",code:doc['district']})
        }
    }).catch(err => {
        console.log('Oh! Dark '+err)
        if(err === "Unauthorised Access")
            bot.sendMessage(msg.chat.id,"Invalid Invitation code")
        else if(err == "Duplicate Found")
            bot.sendMessage(msg.chat.id,"You Have Already set Tracker on same pincode and age group")
        else
            bot.sendMessage(msg.chat.id,"Something went wrong\n<b>Can't set your Tracker</b>",{parse_mode:"HTML"})
    });
})


bot.onText(/\/delTracker/,async (msg,match)=>{
    let name,age,pin;
    user.findOne({chat_id:msg.chat.id}).then(async(doc) => {
        if(doc == null) throw "Unauthorised Access"
        else{
            pin = await askQuestion(msg.chat.id, 'Enter Your Pincode')
            res = deleteObj(doc['appl'], 'pin', Number(pin['text']));
            if(res == null) throw "Invalid Pincode"
            doc['appl'] = res
            doc.save().then(data =>{
                user.findOne({'appl.pin':Number(pin['text'])}).then(rem =>{
                    if(rem == null){
                        updateZipArray({operation:"Del",code:pin['text']})
                    }
                })
                user.findOne({'district':doc['district']}).then(rem =>{
                    if(rem == null){
                        updateDisAppay({operation:"Del",code:doc['district']})
                    }
                    else{
                        try{
                            flag = 0
                            if((rem.appl).length != 0) flag = 1
                            if(flag == 0)
                                updateDisAppay({operation:"Del",code:doc['district']})
                        }catch(err){
                            console.log("Error while Updating Display Array -> "+err)
                        }
                    }
                })
            });      
            bot.sendMessage(msg.chat.id,"Untrack Successfull..!\n<b>Pincode : </b>"+pin['text'],{parse_mode : "HTML"})
            //zip.indexOf(pin['text']) === -1 && zip.push(pin['text']);
        }
    }).catch(err => {
        console.log('Oh! Dark '+err)
        if(err === "Unauthorised Access")
            bot.sendMessage(msg.chat.id,"Invalid Invitation code")
        else if(err === "Invalid Pincode")
            bot.sendMessage(msg.chat.id,"Can't find tracker on <b>"+pin['text']+"</b>",{parse_mode:"HTML"})
        else
            bot.sendMessage(msg.chat.id,"Something went wrong\n<b>Can't set your Tracker</b>",{parse_mode:"HTML"})
    });
})


bot.onText(/\/getDetails/,(msg,match)=>{
    user.findOne({chat_id:msg.chat.id}).then(doc => {
        if(doc == null) throw "Unauthorised Access"
        else{
            //console.log(doc['appl'])
            let st = "<b>Account Details : </b>\n    Name : "+doc['name']+"\n    State : "+doc['state']+"\n    District : "+doc['district']+"\n\n"
            st += "<i><b>Your Available Trackers are : </b></i>";
            doc['appl'].forEach((element,ind) => {
                i = ind+1
                st += "\n   "+i+"]  <b>"+element["a_name"]+"</b> | "+element["a_age"]+" | <b>"+element["pin"]+"</b>"
            });
            st += "\n\nAlerts Paused : "+(doc['paused']?"✅":"❌")
            bot.sendMessage(msg.chat.id,st,{parse_mode:"HTML"})
        }
    }).catch(err => {
        console.log('Oh! Dark '+err)
        if(err === "Unauthorised Access")
            bot.sendMessage(msg.chat.id,"Invalid Invitation code")
        else
            bot.sendMessage(msg.chat.id,"Something went wrong\n<b>Can't Fetch your Tracker's</b>",{parse_mode:"HTML"})
    });
})

bot.onText(/\/changeDis/,(msg,match)=>{
    user.findOne({chat_id:msg.chat.id}).then(doc => {
        if(doc == null) throw "Unauthorised Access"
        else{
            const keyboard = Keyboard.make(getStates(), {
                pattern: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
            }).inline()
            bot.sendMessage(msg.chat.id,"Please Select Your State",keyboard)
        }
    }).catch(err => {
        console.log('Oh! Dark '+err)
        if(err === "Unauthorised Access")
            bot.sendMessage(msg.chat.id,"Invalid Invitation code")
        else
            bot.sendMessage(msg.chat.id,"Something went wrong\n<b>Can't Fetch your Tracker's</b>",{parse_mode:"HTML"})
    })
});

bot.onText(/\/help/, (msg, match) => {
    const resp = "\/setTracker - To Add Tracker to your pin code \n/delTracker - To remove pincode from tracking system\n\/getDetails - To get slots details of your area\n\/pause - To pause slots notifiactions\n\/resume - To resume slots notifications\n\/changeDis - To update your District";
    bot.sendMessage(msg.chat.id, resp,{parse_mode:"HTML"});
});

bot.onText(/\/setProxy/,async(msg,mt)=>{
    if(msg.chat.id == process.env.MY_CHAT_ID){
        bot.sendMessage(msg.chat.id,"Your Current Proxy is : <code>"+cr_host+":"+cr_port+"</code>",{parse_mode:"HTML"})
        proxy = await askQuestion(msg.chat.id,"Enter New Proxy")
        bot.sendMessage(msg.chat.id,"Proxy Server Shifted from : <code>"+cr_host+":"+cr_port+"</code> -> <code>"+proxy['text']+"</code>",{parse_mode:"HTML"})
        proxy = proxy['text'].split(":")
        cr_host = proxy[0]
        cr_port = Number(proxy[1])
    }
})
bot.onText(/\/setBProxy/,async(msg,mt)=>{
    if(msg.chat.id == process.env.MY_CHAT_ID){
        bot.sendMessage(msg.chat.id,"Your Current Backup Proxy is : <code>"+b_host+":"+b_port+"</code>",{parse_mode:"HTML"})
        proxy = await askQuestion(msg.chat.id,"Enter New Proxy")
        bot.sendMessage(msg.chat.id,"Now Backup Proxy set to : <code>"+b_host+":"+b_port+"</code>",{parse_mode:"HTML"})
        proxy = proxy['text'].split(":")
        b_host = proxy[0]
        b_port = Number(proxy[1])
    }
})

/*
setInterval(() => {
    d = new Date().toJSON().slice(0,10).split("-")
    d = d[2]+"-"+d[1]+"-"+d[0]
    zip.forEach(elem => {
        fetchData("https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin?pincode="+elem+"&date="+d).then(data => {
            try{
                data.centers.forEach(cntr =>{
                    cntr.sessions.forEach(ssn =>{
                        if(ssn.available_capacity <= 0){
                            user.findOne({'appl.pin':Number(elem), "appl.a_age"  : {$gte : ssn.min_age_limit} },function (err, data) {
                                if (err) return handleError(err);
                                else{
                                    try{
                                        if(data == null) throw "No Data Found"
                                        msg = "<b>SLOT AVAILABLE...!</b>\n\n<b>Name : </b>"+cntr.name+"\n<b>Pincode : </b>"+cntr.pincode+"\n<b>Fee Type : </b>"+cntr.fee_type+"\n\n<b>Available Slots : </b>\n<b>    Remaining Slots : </b>"+ssn.available_capacity+"\n<b>    Date : </b>"+ssn.date+"\n<b>    vaccine : </b>"+ssn.vaccine
                                        msg += "\n\n/pause - to Pause Messages command \n\n/delTracker - to Remove Tracker on Pincode"
                                        bot.sendMessage(data.chat_id,msg,{parse_mode:"HTML"})
                                    }catch(ex){
                                        console.log("Error "+ex)
                                    }
                                }
                            })
                        }
                    })
                })
            }
            catch(e) {
                console.log("Invalid Data"+e)
            }
        }).catch(data =>{
            console.log(data)
        })
    });
}, 30*1000);
*/

/*
states = {}
st = []
fetchData('https://cdn-api.co-vin.in/api/v2/admin/location/states').then(data =>{
    data.states.forEach(state =>{
        states['"'+String(state.state_name)+'"']=state.state_id
    })
    for (const state in states) {
        fetchData("https://cdn-api.co-vin.in/api/v2/admin/location/districts/"+states[state]).then(data=>{
            dist = {}
            data.districts.forEach(dis =>{
                dist['"'+String(dis.district_name)+'"']=dis.district_id
            })
            states[String(state)] = dist
            if(states.length <=37)
                console.log(states)
        })
    }    
})

*/

setInterval(() => {
    d = new Date().toJSON().slice(0,10).split("-")
    d = d[2]+"-"+d[1]+"-"+d[0]
    ListOfDistricts.forEach(district=>{
        did = getIdByKey(district)
        fetchData1("https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id="+did+"&date="+d).then(data =>{
            console.log("Connected : "+cr_host+":"+cr_port)
            data['data'].centers.forEach(center =>{
                if(zip.indexOf(String(center.pincode)) != -1){
                    try{
                        center.sessions.forEach(session =>{
                            if(session.available_capacity > 0){
                                user.findOne({'appl.pin':Number(center.pincode), "appl.a_age"  : {$gte : session.min_age_limit} },function (err, data) {
                                    if (err) return handleError(err);
                                    else{
                                        try{
                                            if(data == null) throw "No Data Found"
                                            msg = "<b>SLOT AVAILABLE...! ✅</b>\n\n<b>Name : </b>"+center.name+"\n<b>Pincode : </b>"+center.pincode+"\n<b>Fee Type : </b>"+center.fee_type+"\n\n<b>Available Slots : </b>\n<b>    Date : </b><strong>"+session.date+"</strong>\n<b>    Remaining Slots : </b>"+session.available_capacity+"\n<b>    vaccine : </b>"+session.vaccine+"\n    <b>Age Limit : </b>"
                                            //msg += "\n\n/pause - to Pause Messages command \n\n/delTracker - to Remove Tracker on Pincode"
                                            msg += "\n\n<strong>Stay Home, Stay Safe..!  😷</strong>"
                                            const keyboard2 = Keyboard.inline([Key.callback('Booked 👍',"Booked:"+center.pincode),'Not Booked 👎' ])
                                            bot.sendMessage(data.chat_id,msg,{reply_markup:keyboard2["reply_markup"],parse_mode:"HTML"}).catch(err => {
                                                console.log("Message Sending Skipped -> "+err)
                                            })
                                        }catch(ex){
                                            console.log("Error "+ex)
                                        }
                                    }
                                })
                            }
                        })
                    }catch(err){
                        bot.sendMessage(process.env.MY_CHAT_ID,"Error -> <code>"+err+"</code>",{parse_mode:"HTML"})
                        console.log("Error -> "+err)
                    }
                }
            })
        }).catch((err)=>{
            cr_err_cnt += 1
            if(cr_err_cnt == max_err_cnt){
                if(cr_host != b_host){
                    t_host = cr_host
                    t_port = cr_port
                    cr_host = b_host
                    cr_port = b_port
                    b_port = t_port
                    b_host = t_host
                    bot.sendMessage(process.env.MY_CHAT_ID,"Proxy Server Shifted from : <code>"+b_host+":"+b_port+"</code> -> <code>"+cr_host+":"+cr_port+"</code>",{parse_mode:"HTML"})
                }
                cr_err_cnt = 0
            }
            bot.sendMessage(process.env.MY_CHAT_ID,"Error -> <code>"+err+"</code>",{parse_mode:"HTML"})
            console.log("Time Out -> "+err)
        })

    })
}, 10000*60*1);


app.get("/",(req,res)=>{
    res.send("Please Use Telegram Bot")
})


app.listen(process.env.PORT,()=>{
    console.log("Server Running")
})