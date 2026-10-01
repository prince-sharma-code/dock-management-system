const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 8080);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/galleyla_dockmaster';
const JWT_SECRET = process.env.JWT_SECRET || 'galleyla-water7-local-secret';

function databaseNameFromUri(uri) {
  try {
    const url = new URL(uri);
    const name = url.pathname.replace(/^\//, '');
    return name || 'galleyla_dockmaster';
  } catch (_) {
    return 'galleyla_dockmaster';
  }
}

const DB_NAME = process.env.MONGODB_DB || databaseNameFromUri(MONGODB_URI);
let client;
let db;

const DEFAULT_BERTHS = [
  { id:'B1', name:'Berth 1 — Merry Cove', type:'Sloop', emoji:'🛶', desc:'Protected cove slip for small vessels and caravels', active:true },
  { id:'B2', name:'Berth 2 — Thousand Bay', type:'Galleon', emoji:'⛵', desc:'Mid-sized pier equipped with cola refuel pumps', active:true },
  { id:'B3', name:'Berth 3 — Adam Wood Quay', type:'Marine Warship', emoji:'🚢', desc:'Heavily reinforced slip for iron-clad battleships', active:true },
  { id:'B4', name:"Berth 4 — Paulie's Rigging", type:'Sloop', emoji:'🛶', desc:'Fast turnaround slip with rope cranes', active:true },
  { id:'B5', name:"Berth 5 — Blueno's Wharf", type:'Galleon', emoji:'⛵', desc:'Spacious deep-water mooring pier', active:true },
  { id:'B6', name:"Berth 6 — Franky's Yard", type:'Marine Warship', emoji:'🚢', desc:'Cyborg dock equipped with heavy battle repair cranes', active:true },
  { id:'B7', name:'Berth 7 — Iceburg Inlet', type:'Sloop', emoji:'🛶', desc:'Prime entrance slip near Galley-La headquarters', active:true },
  { id:'B8', name:"Berth 8 — Kokoro's Station", type:'Galleon', emoji:'⛵', desc:'Adjoining the Puffing Tom sea-train canal', active:true },
  { id:'B9', name:"Berth 9 — Robin's Haven", type:'Sloop', emoji:'🛶', desc:'Quiet, secluded berth for discrete arrivals', active:true },
  { id:'B10', name:"Berth 10 — Zoro's Bastion", type:'Marine Warship', emoji:'🚢', desc:'Fortified warship quay with three-blade security', active:true },
  { id:'B11', name:"Berth 11 — Nami's Reach", type:'Galleon', emoji:'⛵', desc:'Clear sightlines for Grand Line log pose navigators', active:true },
  { id:'B12', name:"Berth 12 — Luffy's Launch", type:'Sloop', emoji:'🛶', desc:'Adventure launch point with direct open-sea current', active:true }
];

const DEMO_USERS = [
  { username:'luffy', name:'Monkey D. Luffy', email:'luffy@strawhat.sea', password:'gomugomu', ship:'Galleon', score:100, role:'user' },
  { username:'zoro', name:'Roronoa Zoro', email:'zoro@strawhat.sea', password:'santoryu', ship:'Sloop', score:95, role:'user' },
  { username:'law', name:'Trafalgar Law', email:'law@heartpirates.sea', password:'roomshambles', ship:'Sloop', score:98, role:'user' },
  { username:'smoker', name:'Vice Admiral Smoker', email:'smoker@marine.gov', password:'whiteblow', ship:'Marine Warship', score:90, role:'user' },
  { username:process.env.ADMIN_USERNAME || 'iceburg', name:'Iceburg (Admin)', email:'iceburg@galleyla.co', password:process.env.ADMIN_PASSWORD || 'galleyla2024', ship:'Galleon', score:100, role:'admin' }
];

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ message:'Authentication required.' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch (_) {
    res.status(401).json({ message:'Invalid or expired session.' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message:'Admin access required.' });
  next();
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

async function seedDatabase() {
  const users = db.collection('users');
  const berths = db.collection('berths');
  const bookings = db.collection('bookings');
  const noShows = db.collection('noShowLog');
  const fortune = db.collection('fortuneHistory');
  const settings = db.collection('settings');

  if (await berths.countDocuments() === 0) await berths.insertMany(DEFAULT_BERTHS);

  if (await users.countDocuments() === 0) {
    const docs = [];
    for (const user of DEMO_USERS) {
      docs.push({ ...user, password: await bcrypt.hash(user.password, 10), createdAt:new Date() });
    }
    await users.insertMany(docs);
  }

  // Always ensure the Dockmaster admin account exists, even when the users collection was already populated.
  const adminUsername = String(process.env.ADMIN_USERNAME || 'iceburg').trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || 'galleyla2024');
  const existingAdmin = await users.findOne({ username: adminUsername });
  if (!existingAdmin) {
    await users.insertOne({
      username: adminUsername,
      name: 'Iceburg (Admin)',
      email: 'iceburg@galleyla.co',
      password: await bcrypt.hash(adminPassword, 10),
      ship: 'Galleon', score: 100, role: 'admin', cancellations: 0, noShows: 0, createdAt: new Date()
    });
  } else if (existingAdmin.role !== 'admin' || !String(existingAdmin.password || '').startsWith('$2')) {
    await users.updateOne(
      { username: adminUsername },
      { $set: { role: 'admin', password: await bcrypt.hash(adminPassword, 10), name: existingAdmin.name || 'Iceburg (Admin)', ship: existingAdmin.ship || 'Galleon', score: existingAdmin.score ?? 100 } }
    );
  }

  if (await bookings.countDocuments() === 0) {
    const today = new Date().toISOString().slice(0,10);
    await bookings.insertMany([
      { id:'BK-1001', userId:'luffy', captainName:'Monkey D. Luffy', berthId:'B2', shipType:'Galleon', date:today, timeStart:'09:00', timeEnd:'12:00', notes:'Thousand Sunny dock for cola reload', status:'checked_in', createdAt:new Date(Date.now()-3600000).toISOString() },
      { id:'BK-1002', userId:'smoker', captainName:'Vice Admiral Smoker', berthId:'B3', shipType:'Marine Warship', date:today, timeStart:'13:00', timeEnd:'16:00', notes:'Marine patrol standby at Adam Wood quay', status:'confirmed', createdAt:new Date(Date.now()-7200000).toISOString() }
    ]);
  }
  if (await noShows.countDocuments() === 0) await noShows.insertOne({ initialized:true, createdAt:new Date() });
  if (await fortune.countDocuments() === 0) await fortune.insertOne({ initialized:true, createdAt:new Date() });
  if (await settings.countDocuments() === 0) await settings.insertOne({ audio:{volume:0.8}, theme:'water7', sync:'backend-enabled' });

  await bookings.createIndex({ berthId:1, date:1, timeStart:1, timeEnd:1 });
  await users.createIndex({ username:1 }, { unique:true });
}

async function state() {
  const [berths, users, bookings, noShowLog, fortuneHistory, settings] = await Promise.all([
    db.collection('berths').find({}).toArray(),
    db.collection('users').find({}).toArray(),
    db.collection('bookings').find({}).sort({createdAt:-1}).toArray(),
    db.collection('noShowLog').find({ initialized: { $ne:true } }).sort({timestamp:-1}).toArray(),
    db.collection('fortuneHistory').find({ initialized: { $ne:true } }).sort({timestamp:-1}).limit(12).toArray(),
    db.collection('settings').findOne({})
  ]);
  return { berths, users:users.map(sanitizeUser), bookings, noShowLog, fortuneHistory, lastFortune:settings?.lastFortune || null, appSettings:settings || {audio:{volume:0.8},theme:'water7',sync:'backend-enabled'} };
}

async function updateMetaState(body) {
  const settings = db.collection('settings');
  const existing = await settings.findOne({}) || { audio:{volume:0.8}, theme:'water7', sync:'backend-enabled' };
  const patch = {};
  if (body.appSettings) patch.appSettings = body.appSettings;
  if (body.lastFortune !== undefined) patch.lastFortune = body.lastFortune;
  await settings.updateOne({}, { $set:{ ...(body.appSettings || existing), ...(body.lastFortune !== undefined ? {lastFortune:body.lastFortune}: {}) } }, {upsert:true});
  if (Array.isArray(body.fortuneHistory)) {
    await db.collection('fortuneHistory').deleteMany({ initialized:{ $ne:true } });
    if (body.fortuneHistory.length) {
      const docs = body.fortuneHistory.map(({ _id, ...x }) => x);
      await db.collection('fortuneHistory').insertMany(docs);
    }
  }
  return patch;
}

app.use(cors());
app.use(express.json({limit:'2mb'}));

app.get('/api/health', (req,res)=>res.json({ok:true,database:'mongodb',dbName:DB_NAME,timestamp:new Date().toISOString()}));

app.get('/api/state', async (req,res)=>{
  try { res.json(await state()); } catch(e) { res.status(500).json({message:'Unable to load backend state.',error:e.message}); }
});

// Compatibility endpoint for the existing frontend. It updates only metadata/fortune;
// bookings and users are written through dedicated API endpoints below.
app.post('/api/state', auth, async (req,res)=>{
  try { await updateMetaState(req.body || {}); res.json({ok:true,state:await state()}); }
  catch(e){ res.status(500).json({message:'Unable to save backend state.',error:e.message}); }
});

app.post('/api/auth/register', async (req,res)=>{
  try {
    const {name,username,email,password,ship='Sloop'} = req.body || {};
    if (!name || !username || !password) return res.status(400).json({message:'Name, username, and password are required.'});
    if (String(password).length < 6) return res.status(400).json({message:'Password must be at least 6 characters.'});
    const normalized = String(username).trim().toLowerCase();
    if (await db.collection('users').findOne({username:normalized})) return res.status(409).json({message:'That captain call sign is already in use.'});
    const user = {username:normalized,name:String(name).trim(),email:String(email||'').trim(),password:await bcrypt.hash(password,10),ship,score:100,role:'user',cancellations:0,noShows:0,createdAt:new Date()};
    await db.collection('users').insertOne(user);
    const token = jwt.sign({username:user.username,role:user.role},JWT_SECRET,{expiresIn:'7d'});
    res.status(201).json({token,user:sanitizeUser(user)});
  } catch(e){ res.status(500).json({message:'Registration failed.',error:e.message}); }
});

app.post('/api/auth/login', async (req,res)=>{
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({message:'Captain call sign and secret code are required.'});
    }
    if (username.length < 2) {
      return res.status(400).json({message:'Captain call sign must contain at least 2 characters.'});
    }
    if (password.length < 6) {
      return res.status(400).json({message:'Secret code must contain at least 6 characters.'});
    }

    const users = db.collection('users');
    let user = await users.findOne({username});

    // First-time captain convenience: if the call sign does not exist yet,
    // create the account from the existing login form. This keeps the current
    // UI unchanged while ensuring the credentials are persisted in MongoDB.
    if (!user) {
      const newUser = {
        username,
        name: username,
        email: '',
        password: await bcrypt.hash(password, 10),
        ship: 'Sloop',
        score: 100,
        role: 'user',
        cancellations: 0,
        noShows: 0,
        createdAt: new Date()
      };
      await users.insertOne(newUser);
      user = newUser;
      const token = jwt.sign({username:user.username,role:user.role},JWT_SECRET,{expiresIn:'7d'});
      return res.status(201).json({token,user:sanitizeUser(user),created:true,message:'New captain registered and logged in.'});
    }

    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({message:'Invalid username or password.'});
    }

    const token = jwt.sign({username:user.username,role:user.role},JWT_SECRET,{expiresIn:'7d'});
    res.json({token,user:sanitizeUser(user),created:false});
  } catch(e){
    if (e?.code === 11000) return res.status(409).json({message:'That captain call sign is already in use.'});
    res.status(500).json({message:'Login failed.',error:e.message});
  }
});

app.get('/api/auth/me', auth, async (req,res)=>{
  const user = await db.collection('users').findOne({username:req.user.username});
  if (!user) return res.status(404).json({message:'User not found.'});
  res.json({user:sanitizeUser(user)});
});

app.get('/api/bookings', auth, async (req,res)=>{
  const query = req.user.role === 'admin' ? {} : {userId:req.user.username};
  res.json(await db.collection('bookings').find(query).sort({createdAt:-1}).toArray());
});

app.post('/api/bookings', auth, async (req,res)=>{
  try {
    const {berthId,date,timeStart,timeEnd,notes,shipType,fortune,receipt} = req.body || {};
    if (!berthId || !date || !timeStart || !timeEnd) return res.status(400).json({message:'Berth, date, start time and end time are required.'});
    if (timeStart >= timeEnd) return res.status(400).json({message:'End time must be after start time.'});
    const berth = await db.collection('berths').findOne({id:berthId,active:{$ne:false}});
    if (!berth) return res.status(404).json({message:'Berth not found.'});
    const conflict = await db.collection('bookings').findOne({
      berthId,date,status:{$nin:['cancelled','no_show']},
      timeStart:{$lt:timeEnd},timeEnd:{$gt:timeStart}
    });
    if (conflict) return res.status(409).json({message:`Berth ${berthId} is already reserved for an overlapping time window.`});
    const user = await db.collection('users').findOne({username:req.user.username});
    const booking = {
      id:'BK-'+Date.now().toString().slice(-8), userId:user.username, captainName:user.name || user.username,
      berthId, shipType:shipType || user.ship || 'Sloop', date,timeStart,timeEnd,notes:notes||'',fortune:fortune||null,receipt:receipt||null,status:'confirmed',createdAt:new Date().toISOString()
    };
    await db.collection('bookings').insertOne(booking);
    res.status(201).json({booking});
  } catch(e){ res.status(500).json({message:'Unable to create booking.',error:e.message}); }
});

app.patch('/api/bookings/:id/cancel', auth, async (req,res)=>{
  const booking = await db.collection('bookings').findOne({id:req.params.id});
  if (!booking) return res.status(404).json({message:'Booking not found.'});
  if (req.user.role !== 'admin' && booking.userId !== req.user.username) return res.status(403).json({message:'You cannot cancel this booking.'});
  if (['cancelled','no_show'].includes(booking.status)) return res.status(400).json({message:'Booking is already closed.'});
  await db.collection('bookings').updateOne({id:booking.id},{$set:{status:'cancelled',cancelledAt:new Date().toISOString()}});
  if (booking.userId) {
    const u = await db.collection('users').findOne({username:booking.userId});
    const nextScore = Math.max(0, (u?.score || 0) - 5);
    await db.collection('users').updateOne({username:booking.userId},{$set:{score:nextScore},$inc:{cancellations:1}});
  }
  await db.collection('noShowLog').insertOne({timestamp:new Date().toISOString(),username:booking.userId,berthId:booking.berthId,type:'User Cancellation',impact:'-5 Karma'});
  const updatedUser = await db.collection('users').findOne({username:booking.userId});
  res.json({booking:{...booking,status:'cancelled',cancelledAt:new Date().toISOString()},user:sanitizeUser(updatedUser)});
});

app.patch('/api/bookings/:id/checkin', auth, async (req,res)=>{
  const booking = await db.collection('bookings').findOne({id:req.params.id});
  if (!booking) return res.status(404).json({message:'Booking not found.'});
  if (req.user.role !== 'admin' && booking.userId !== req.user.username) return res.status(403).json({message:'You cannot check in this booking.'});
  if (booking.status !== 'confirmed') return res.status(400).json({message:'Only confirmed bookings can be checked in.'});
  const checkedInAt = new Date().toISOString();
  await db.collection('bookings').updateOne({id:booking.id},{$set:{status:'checked_in',checkedInAt}});
  const captain = await db.collection('users').findOne({username:booking.userId});
  const nextScore = Math.min(100, (captain?.score || 0) + 2);
  await db.collection('users').updateOne({username:booking.userId},{$set:{score:nextScore}});
  const updatedUser = await db.collection('users').findOne({username:booking.userId});
  res.json({booking:{...booking,status:'checked_in',checkedInAt},user:sanitizeUser(updatedUser)});
});

app.post('/api/no-shows/process', auth, async (req,res)=>{
  try {
    const now = new Date();
    const today = now.toISOString().slice(0,10);
    const nowMins = now.getHours()*60 + now.getMinutes();
    const candidates = await db.collection('bookings').find({status:'confirmed'}).toArray();
    const changed = [];

    for (const booking of candidates) {
      let overdue = booking.date < today;
      if (booking.date === today) {
        const [h,m] = String(booking.timeStart || '00:00').split(':').map(Number);
        overdue = nowMins > ((h||0)*60 + (m||0) + 15);
      }
      if (!overdue) continue;

      if (req.user.role !== 'admin' && booking.userId !== req.user.username) continue;
      await db.collection('bookings').updateOne({id:booking.id,status:'confirmed'},{$set:{status:'no_show',noShowAt:now.toISOString()}});
      const user = await db.collection('users').findOne({username:booking.userId});
      const nextScore = Math.max(0,(user?.score || 0)-15);
      await db.collection('users').updateOne({username:booking.userId},{$set:{score:nextScore},$inc:{noShows:1}});
      await db.collection('noShowLog').insertOne({timestamp:now.toISOString(),username:booking.userId,berthId:booking.berthId,type:'Berth No-Show Forfeiture',impact:'-15 Karma'});
      changed.push({...booking,status:'no_show',noShowAt:now.toISOString()});
    }
    res.json({changed});
  } catch(e) {
    res.status(500).json({message:'Unable to process no-shows.',error:e.message});
  }
});

app.get('/api/admin/summary', auth, adminOnly, async (req,res)=>{
  const bookings = await db.collection('bookings').find({}).toArray();
  const users = await db.collection('users').find({}).toArray();
  const berths = await db.collection('berths').find({active:{$ne:false}}).toArray();
  res.json({totalBerths:berths.length,totalUsers:users.length,totalBookings:bookings.length,activeBookings:bookings.filter(b=>['confirmed','checked_in'].includes(b.status)).length,checkIns:bookings.filter(b=>b.status==='checked_in').length,cancellations:bookings.filter(b=>b.status==='cancelled').length,noShows:bookings.filter(b=>b.status==='no_show').length});
});

app.use(express.static(__dirname));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));

async function start(){
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    await seedDatabase();
    console.log(`MongoDB connected: ${DB_NAME}`);
    app.listen(PORT,()=>console.log(`DockMaster backend running at http://localhost:${PORT}`));
  } catch(e) {
    console.error('MongoDB connection failed. Make sure MongoDB is running on Windows.');
    console.error(e.message);
    process.exit(1);
  }
}

start();
