const express = require("express")
const bodyParser = require('body-parser')
const https = require('https');
const TelegramBot = require('node-telegram-bot-api');
const { Keyboard,Key } = require('telegram-keyboard')
const axios = require('axios');
const tunnel = require('tunnel');

require("dotenv").config()

const bot = new TelegramBot(process.env.tokens2, {polling: true});
const app = express()
const db = require("./initDB")
const { user,appn,districts,pincodes } = require("./schema");
const { now } = require("mongoose");


app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const states = require("./states.json")

//data = require("./data.json")
let zip = []
let ListOfDistricts = []

let max_err_cnt = 2
let cr_err_cnt = 0
let cr_host = process.env.PROXY_HOST
let cr_port = process.env.PROXY_PORT

let b_host = process.env.B_HOST
let b_port = process.env.B_PORT


hind = -1
hsts = ['0.0.0.0:8080']

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
                            timeout:800
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
        pincodes.find({pincode:opn.code}).then(data => {
            if(data == null || data.length == 0){
                pin = new pincodes({pincode:opn.code})
                pin.save().then(d =>{
                    console.log(d['pincode']+" Added in Database")
                }).catch(err=>{
                    console.log("Error while adding pincode into Database ->"+err)
                })
            }
        })
    }
    else if(opn.operation == "Del"){
        var index = zip.indexOf(opn.code);
        if (index !== -1) {
            zip.splice(index, 1);
        }
        pincodes.deleteOne({pincode:opn.code}).then(data => {
            console.log("Pincode Removed from Database")
        }).catch(err => {
            console.log("Error while deleting pincode from Database -> "+err)
        })
    }
    console.log("Zip : "+zip)
}
const updateDisAppay = (opn)=>{
    if(opn.operation == "Add"){
        ListOfDistricts.indexOf(opn.code) === -1 && ListOfDistricts.push(opn.code);
        districts.find({name:opn.code}).then(data => {
            if(data == null || data.length == 0){
                pin = new districts({name:opn.code})
                pin.save().then(d =>{
                    console.log(d['name']+" Added in Database")
                }).catch(err=>{
                    console.log("Error while adding District into Database ->"+err)
                })
            }
        })
    }
    else if(opn.operation == "Del"){
        var index = ListOfDistricts.indexOf(opn.code);
        if (index !== -1) {
            ListOfDistricts.splice(index, 1);
        }
        districts.deleteOne({name:opn.code}).then(data => {
            console.log("District Removed from Database")
        }).catch(err => {
            console.log("Error while deleting District from Database ->"+err)
        })
    }
    console.log("Dist : "+ListOfDistricts)
}

const slotBooked = (c_id,pin,msg_id) =>{
    user.findOne({chat_id:c_id}).then(doc => {
        if(doc == null) throw "Unauthorised Access"
        else{
            doc['appl'] = deleteObj(doc['appl'], 'pin', Number(pin));
            doc.save().then(data =>{
                user.find({'appl.pin':Number(pin)}).then(rem =>{
                    if(rem == null || rem.length == 0){
                        updateZipArray({operation:"Del",code:pin})
                    }
                }).catch(e=>{
                    console.log("Error while getting data by pincodes "+e)
                })
                user.find({district:doc['district']}).then(databyd =>{
                    let flg = 1
                    databyd.forEach(d =>{
                        if(d['appl'].length != 0)
                            flg = 0
                    })
                    if(flg == 1){
                        updateDisAppay({operation:"Del",code:data['district']})
                    }
                })
            });      
            bot.sendMessage(c_id,"<b>Congratulations...!</b> \n\n <i>As you have Booked slot, I removed tracker from <strong>"+pin+"</strong>. If you want to track it again use /setTracker Command</i>",{parse_mode : "HTML"}).then(()=>{
               // bot.editMessageReplyMarkup(msg_id,{reply_markup:null})
                //bot.editMessageReplyMarkup("hello",{message_id:msg_id,chat_id:c_id,reply_markup:{remove_keyboard:true}})
                bot.deleteMessage(c_id,msg_id)
            })
            //zip.indexOf(pin) === -1 && zip.push(pin);
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
        bot.sendMessage(callbackQuery.from.id,"Now you can /setTracker on pincode which belongs to  <b>"+callbackQuery.data+"</b> District",{parse_mode:"HTML"})
        user.findOneAndUpdate({chat_id:callbackQuery.from.id}, {district:callbackQuery.data,appl:[]}, function(err, doc) {
            if (err) console.log("District Updation Failed");
        });
    }
    else{
        if(callbackQuery.data.split(":")[0]=="Booked"){
            slotBooked(callbackQuery.from.id,callbackQuery.data.split(":")[1],callbackQuery.message.message_id)
            console.log("Slot Booked")
        }
        else if(callbackQuery.message.text == 'Select IP To POP'){
            bot.deleteMessage(callbackQuery.from.id,callbackQuery.message.message_id)
            var index = hsts.indexOf(callbackQuery.data);
            if (index !== -1) {
                hsts.splice(index, 1);
            } 
            msg = "List op Proxy's : \n"
            hsts.forEach(ips => { msg += "<code>"+ips+"</code>\n" })
            bot.sendMessage(process.env.MY_CHAT_ID,msg,{parse_mode:"HTML"})
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
            //console.log(res)
            if(res == null) throw "Invalid Pincode"
            doc['appl'] = res
            doc.save().then(data =>{
                user.find({'appl.pin':Number(pin['text'])}).then(rem =>{
                    if(rem == null || rem.length == 0){
                        updateZipArray({operation:"Del",code:pin['text']})
                    }
                }).catch(e=>{
                    console.log("Error while getting data by pincodes")
                })
                user.find({district:doc['district']}).then(databyd =>{
                    let flg = 1
                    databyd.forEach(d =>{
                        if(d['appl'].length != 0)
                            flg = 0
                    })
                    if(flg == 1){
                        updateDisAppay({operation:"Del",code:data['district']})
                    }
                })
            });      
            bot.sendMessage(msg.chat.id,"<b>Tracker Removed..!\n</b><i>I removed tracker from <strong>"+pin['text']+"</strong>. If you want to track it again use  /setTracker Command</i>",{parse_mode : "HTML"})
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
            st += "\n\nAlerts Paused : "+(doc['paused']?"???":"???")
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

bot.onText(/\/pause/,(msg,match)=>{
    user.findOneAndUpdate({chat_id:msg.chat.id},{paused:true}).then(doc => {
        if(doc == null) throw "Unauthorised Access"
        else{
            bot.sendMessage(msg.chat.id,"Now I have paused your alert messages.\n<i>you can start it using /resume command</i>.",{parse_mode:"HTML"})
        }
    }).catch(err => {
        console.log('Oh! Dark '+err)
        if(err === "Unauthorised Access")
            bot.sendMessage(msg.chat.id,"Invalid Invitation code")
        else
            bot.sendMessage(msg.chat.id,"Something went wrong\n<b>Can't Fetch your Tracker's</b>",{parse_mode:"HTML"})
    })
})

bot.onText(/\/resume/,(msg,match)=>{
    user.findOneAndUpdate({chat_id:msg.chat.id},{paused:false}).then(doc => {
        if(doc == null) throw "Unauthorised Access"
        else{
            bot.sendMessage(msg.chat.id,"Your alert messages are activated.\n<i>Once sloat available in your area I will send message to you.</i>.",{parse_mode:"HTML"})
        }
    }).catch(err => {
        console.log('Oh! Dark '+err)
        if(err === "Unauthorised Access")
            bot.sendMessage(msg.chat.id,"Invalid Invitation code")
        else
            bot.sendMessage(msg.chat.id,"Something went wrong\n<b>Can't Fetch your Tracker's</b>",{parse_mode:"HTML"})
    })
})

bot.onText(/\/status/,(msg,mt)=>{
    if(msg.chat.id == process.env.MY_CHAT_ID){
        bot.sendMessage(process.env.MY_CHAT_ID,"<b>Pincodes : </b><code>"+zip.toString()+"</code>\n\n<b>District : </b>"+ListOfDistricts.toString()+"\n\nCurrent Proxy : <code>"+cr_host+":"+cr_port+"</code>\n Backup : <code>"+b_host+":"+b_port+"</code>",{parse_mode:"HTML"})
    }
})

let ipdowncnt = 0;

let dis_ind = 0;

const sendMessages = async()=>{
    d = new Date().toJSON().slice(0,10).split("-")
    d = d[2]+"-"+d[1]+"-"+d[0]
    did = getIdByKey(ListOfDistricts[dis_ind])
    await fetchData1("https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id="+did+"&date="+d).then(data =>{
            cr_err_cnt = 0
            ipdowncnt = 0
            console.log("Connected : "+cr_host+":"+cr_port+" => "+ListOfDistricts[dis_ind]+" "+dis_ind)
            centers = data['data'].centers.filter((center)=> {
                if(zip.indexOf(String(center.pincode)) !== -1){
                    str = ""
                    session = center['sessions'].filter((ssn,ind)=>{
                        if(ssn.available_capacity > 0){ // Change This for Befour Deployment
                            str += "<strong>  Date : "+ssn.date+"</strong>\n<b>      Remaining Slots : </b>"+ssn.available_capacity+"\n          <b>Dose-1 Capacity : </b>"+ssn.available_capacity_dose1+"\n          <b>Dose-2 Capacity : </b>"+ssn.available_capacity_dose2+"\n<b>      vaccine : </b>"+ssn.vaccine+"\n      <b>Age Limit : </b>"+ssn.min_age_limit+"+\n\n"
                            return ssn
                        }
                    })
                    if(session.length > 0){
                        center['sessions'] = session
                        center['session_msg'] = str
                        return center
                    }
                } 
            })

            if(centers.length > 1){
                //console.log(centers[0]['district_name'])
                user.find({district:String(centers[0]['district_name']),paused:false},(err,dbdata) => {
                    try{
                        if(err) throw "Database Error : "+err
                        else if(dbdata == null && dbdata.length == 0) throw "No Data with "+centers['district_name']
                        else{
                            dbdata.forEach(usr => {
                                usr['appl'].filter(appl=>{
                                    cn = centers.filter(cntr=> { if(cntr.pincode == Number(appl.pin)) return cntr })
                                    if(cn.length > 0){
                                        cn.forEach(cntr => {
                                            msg = "<b>SLOT AVAILABLE...! ???</b>\n\n<b>Name : </b>"+cntr.name+"\n<b>Pincode : </b>"+cntr.pincode+"\n<b>Fee Type : </b>"+cntr.fee_type+"\n\n<b>Available Slots : </b>\n"
                                            //msg += "\n\n/pause - to Pause Messages command \n\n/delTracker - to Remove Tracker on Pincode"
                                            msg += cntr['session_msg']
                                            msg += "\n\n<strong>Stay Home, Stay Safe..!  ????</strong>"
                                            const keyboard2 = Keyboard.inline([Key.callback('Booked ????',"Booked:"+cntr.pincode),'Not Booked ????' ])
                                            bot.sendMessage(usr.chat_id,msg,{reply_markup:keyboard2["reply_markup"],parse_mode:"HTML"}).catch(err => {
                                                console.log("Message Sending Skipped -> "+err)
                                            })
                                        })
                                    }
                                })
                            })
                        }

                    }catch(dberr){
                        console.log("DB Error -> "+dberr)
                    }      
                })
            }
            dis_ind += 1
            setTimeout(sendMessages, 60*1000*(Number(process.env.ref_tm)));
        }).catch(error =>{
            cr_err_cnt += 1
            ipdowncnt += 1
            if(cr_err_cnt == max_err_cnt){
                if(cr_host != b_host){
                    t_host = cr_host
                    t_port = cr_port
                    cr_host = b_host
                    cr_port = b_port
                    b_port = t_port
                    b_host = t_host
                    //bot.sendMessage(process.env.MY_CHAT_ID,"Proxy Server Shifted from : <code>"+b_host+":"+b_port+"</code> -> <code>"+cr_host+":"+cr_port+"</code>",{parse_mode:"HTML"})
                    console.log("IP Shifted")
                }
                if((ipdowncnt % 10)==0){
                    bot.sendMessage(process.env.MY_CHAT_ID,"Proxy Down, Max Try :<b>"+ipdowncnt+"</b>\n\n Current : <code>"+cr_host+":"+cr_port+"</code> \nBackup : <code>"+b_host+":"+b_port+"</code>",{parse_mode:"HTML"})
                }
                cr_err_cnt = 0
                //rotateIP()
            }
            console.log("<"+ListOfDistricts[dis_ind]+"> Data Fetching Error -> "+error)
            setTimeout(sendMessages, 60*1000*(Number(process.env.ref_tm)));
        });

        if(dis_ind == ListOfDistricts.length)
            dis_ind = 0

}


// Process Termination
const fs = require('fs');
const { brotliCompress } = require("zlib");
const a = [`exit`,`SIGINT`,`SIGUSR1`,`SIGUSR2`,`uncaughtException`,`SIGTERM`]
a.forEach((eventType)=>{
    process.on(eventType,()=>{
        d = JSON.stringify({'listOfzip':zip.toString(),'dis':ListOfDistricts.toString()})
        //console.log(d)
        /*
        fs.writeFile('data.json',d,err=>{
            console.log(err)
        })
        */
        bot.sendMessage(process.env.MY_CHAT_ID,"Server Disconnected")
        console.log("Process Terminating")
    })
})


const fetchDisPin = async()=>{
    await districts.find({},{name:1,_id:0}).then(data => {
        data.forEach(dis => {
            ListOfDistricts.push(dis['name'])
        })
        console.log("Districts Fetched")
    }).catch(err => {
        console.log("Error while fetching Districts")
    })
    await pincodes.find({},{pincode:1,_id:0}).then(data => {
        data.forEach(dis => {
            zip.push(dis['pincode'])
        })
        console.log("Pincodes Fetched")
    }).catch(err => {
        console.log("Error while fetching Pincodes")
    })
}

// Web Routs 
app.get("/",(req,res)=>{
    res.send("Please Use Telegram Bot")
})


app.listen(process.env.PORT,async ()=>{
    bot.sendMessage(process.env.MY_CHAT_ID,"Server Started...!")
    console.log("Server Running")
    await fetchDisPin()
    sendMessages();
    
    console.log("List of Districts : "+ListOfDistricts)
    console.log("List of Pincodes : "+zip)
})
