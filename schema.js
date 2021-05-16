const mongoose  = require('mongoose')
require('./initDB')

const appn = new mongoose.Schema({ a_name: String, a_age:Number, vaccinated:Boolean, pin:Number });

let Users = new mongoose.Schema({
    name: {type: String},
    state: {type:String},
    district : {type:String},
    chat_id: {type: String},
    paused: {type: Boolean},
    appl:[appn],
    accVerified:{type:Boolean}
},{timestamps:true})

let dis = new mongoose.Schema({
    name:{type:String}
})

let pin = new mongoose.Schema({
    pincode:{type:String}
})


user = mongoose.model('user', Users);
districts = mongoose.model('districts',dis)
pincodes = mongoose.model('pincodes',pin)
module.exports = {user,appn,districts,pincodes}