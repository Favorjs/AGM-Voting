require('dotenv').config();
const express = require('express');
const session = require('express-session');
const Sequelize = require('sequelize');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const { Op,DataTypes } = require('sequelize');
const cors = require('cors');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);

const MySQLStore = require('express-mysql-session')(session);

// Add this after your Sequelize initialization

const requireAuth = (req, res, next) => {
  console.log('Session debug:', req.session); // For debugging
  if (!req.session?.userId) {
    return res.status(401).json({ 
      success: false,
      error: 'Not authenticated' 
    });
  }
  next();
};
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});


// Database setup

const sequelize = new Sequelize(
    process.env.DB_NAME || 'e-voting',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || '',
    {
      host: process.env.DB_HOST || 'localhost',
      dialect: 'mysql',
      logging: false,
    }
  );
  const sessionStore = new MySQLStore({
    host: process.env.DB_HOST || 'localhost',
    port: 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'e-voting',
    clearExpired: true,
    checkExpirationInterval: 900000, // 15 minutes
    expiration: 86400000 // 24 hours
  });
  
  app.use(session({
    key: 'session_cookie_name',
    secret: 'your-secret-key-change-this',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true if using HTTPS
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));


// const RegisteredUser = sequelize.define('RegisteredUsers', {
//   acno: { type: DataTypes.STRING, allowNull: false, primaryKey: false},
//   name: DataTypes.STRING,
 
//   address: DataTypes.STRING,
//   holdings: DataTypes.STRING,
//   phone_number: DataTypes.STRING,
//   email: DataTypes.STRING,
//   chn: DataTypes.STRING,
//   rin: DataTypes.STRING,
//   hasVoted: { type: Sequelize.BOOLEAN, defaultValue: false }
// }, {
//   timestamps: false,
//   freezeTableName: true
// });

const RegisteredUser = sequelize.define('registeredusers', {
  name: DataTypes.STRING,
  acno: DataTypes.STRING,
  holdings: {
    type: DataTypes.INTEGER,
    defaultValue: 0 // Add this
  },
  chn: { type:Sequelize.STRING, allowNull: true },
  email: DataTypes.STRING,
  phone_number: DataTypes.STRING,
  registered_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  sessionId: DataTypes.STRING, 
  
});

  

const Resolution = sequelize.define('Resolution', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  title: Sequelize.STRING,
  description: Sequelize.TEXT,

  order: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
 
  isActive: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  },

  proxyVotes: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  
},
 {
  indexes: [
    {
      fields: ['order']
    }
  ]
});



io.on('connection', (socket) => {
  console.log('New client connected');


  socket.on('new-vote', async ({ resolutionId }) => {
    try {
      const voteCounts = await Vote.findAll({
        where: { ResolutionId: resolutionId },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
          [sequelize.fn('SUM', sequelize.cast(sequelize.col('decision'), 'integer')), 'yes'],
        ],
        raw: true
      });
  
      // Safely extract counts and ensure they are numbers
      const counts = voteCounts[0] || { total: 0, yes: 0 };
      const total = parseInt(counts.total) || 0;
      const yes = parseInt(counts.yes) || 0;
      const no = total - yes;
  
      io.emit('vote-updated', {
        resolutionId,
        yes,
        no,
        total // Make sure this is included
      });
    } catch (error) {
      console.error('Error updating vote counts:', error);
      socket.emit('vote-error', { 
        message: 'Failed to update vote counts',
        resolutionId
      });
    }
  });




  // Send current state to new connections
  Resolution.findOne({ where: { isActive: true } }).then(resolution => {
    if (resolution) {
      socket.emit('resolution-activated', resolution);
    }
  });
  socket.emit('voting-state', votingState);
});

const broadcastResolutionUpdate = async () => {
  const activeResolution = await Resolution.findOne({ 
    where: { isActive: true },
    include: [Vote]
  });
  io.emit('resolution-update', activeResolution);
};

let votingState = false;

app.post('/api/admin/voting/open', (req, res) => {
  setVotingState(true);
  io.emit('voting-toggle', true);
  res.json({ success: true });
});

app.post('/api/admin/voting/close', (req, res) => {
  setVotingState(false);
  io.emit('voting-toggle', false);
  res.json({ success: true });
});





const Vote = sequelize.define('Vote', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  decision: { type: Sequelize.BOOLEAN, allowNull: false },
  holdings: {
    type: DataTypes.INTEGER,
    defaultValue: 0 // Add this
  },
});




// Define associations
RegisteredUser.hasMany(Vote);
Resolution.hasMany(Vote);
Vote.belongsTo(RegisteredUser);
Vote.belongsTo(Resolution);

// Sync database
sequelize.sync().then(() => {
  console.log('Database & tables created!');
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static('public'));


app.use(cors({
  origin: 'http://localhost:5173', // Vite default port
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Routes
// Authentication routes
app.post('/api/login', async (req, res) => {
  const { identifier } = req.body;
  
  try {
    const user = await RegisteredUser.findOne({
      where: {
        [Sequelize.Op.or]: [
          { email: identifier },
          { phone_number: identifier }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

// Check if user already has an active session
if (user.sessionId) {
  // Option 1: Force logout previous session
  await sessionStore.destroy(user.sessionId);
  
  //Option 2: Prevent new login
  // return res.status(409).json({ 
  //   error: 'User already logged in elsewhere' 
  // });
}

    // Create new session
    req.session.regenerate(async(err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ error: 'Login failed' });
      }

      req.session.userId = user.id;
      req.session.userName = user.name;

    // Update user with current session ID
   await user.update({ sessionId: req.sessionID });



      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ error: 'Login failed' });
        }

        res.json({ 
          success: true,
          message: `Welcome ${user.name}`,
          user: { id: user.id, name: user.name }
        });
      });
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});



// Get all resolutions with vote counts
app.get('/api/resolutions', async (req, res) => {
  try {
    const resolutions = await Resolution.findAll({
      attributes: ['id', 'title', 'description', 'order', 'isActive'],
      include: [{
        model: Vote,
        attributes: [
          [sequelize.fn('COUNT', sequelize.fn('IF', sequelize.col('decision'), 1, null)), 'yesVotes'],
          [sequelize.fn('COUNT', sequelize.fn('IF', sequelize.literal('NOT decision'), 1, null)), 'noVotes']
        ]
      }],
      group: ['Resolution.id'],
      order: [['order', 'ASC']]
    });

    // Format the response
    const formattedResolutions = resolutions.map(resolution => ({
      id: resolution.id,
      title: resolution.title,
      description: resolution.description,
      order: resolution.order,
      isActive: resolution.isActive,
      yesVotes: resolution.Votes[0]?.dataValues?.yesVotes || 0,
      noVotes: resolution.Votes[0]?.dataValues?.noVotes || 0
    }));

    res.json(formattedResolutions);
  } catch (error) {
    console.error('Error fetching resolutions:', error);
    res.status(500).json({ error: 'Failed to fetch resolutions' });
  }
});



// Get current voting state
app.get('/api/admin/voting/state', (req, res) => {
  res.json({ isOpen: votingState });
});

// Voting route
// app.post('/vote', async (req, res) => {
//   if (!req.session.userId) return res.status(401).send('Unauthorized');
  
//   try {
//     const user = await RegisteredUser.findByPk(req.session.userId);
//     if (user.hasVoted) return res.status(400).send('Already voted');

//     const { resolutionId, decision } = req.body;
    
//     await Vote.create({
//       decision,
//       RegisteredUserId: user.id,
//       ResolutionId: resolutionId
//     });

//     await user.update({ hasVoted: true });
//     res.send('Vote recorded successfully');
//   } catch (error) {
//     res.status(500).send('Error recording vote');
//   }
// });

// Add to server.js
app.put('/api/admin/resolutions/:id/proxy', async (req, res) => {
  try {
    const { proxyVotes } = req.body;
    
    if (typeof proxyVotes !== 'number' || proxyVotes < 0) {
      return res.status(400).json({ error: 'Invalid proxy vote count' });
    }

    const resolution = await Resolution.findByPk(req.params.id);
    if (!resolution) {
      return res.status(404).json({ error: 'Resolution not found' });
    }

    await resolution.update({ proxyVotes });
    
    // Broadcast updated resolution
    if (resolution.isActive) {
      const activeResolution = await Resolution.findOne({
        where: { isActive: true },
        include: [Vote]
      });
      io.emit('resolution-update', activeResolution);
    }

    res.json({ success: true, proxyVotes });
  } catch (error) {
    console.error('Proxy vote error:', error);
    res.status(500).json({ error: 'Failed to update proxy votes' });
  }
});

app.get('/api/voting/resolutions', async (req, res) => {
  try {
    const resolutions = await Resolution.findAll({
      attributes: ['id', 'title', 'description', 'order'],
      order: [['order', 'ASC']]
    });
    
    res.json(resolutions);
  } catch (error) {
    console.error('Voting API error:', error);
    res.status(500).json({ error: 'Failed to fetch voting resolutions' });
  }
});

// server.js - Updated resolution endpoint
app.post('/api/admin/resolutions', async (req, res) => {
  // Add basic validation
  if (!req.body.title || !req.body.description) {
    return res.status(400).json({ 
      error: 'Title and description are required' 
    });
  }

  try {
    const resolution = await Resolution.create({
      title: req.body.title,
      description: req.body.description
    });
    
    // Return the created resolution with 201 status
    res.status(201).json(resolution);
    
  } catch (error) {
    console.error('Creation error:', {
      error: error.name,
      message: error.message,
      validationErrors: error.errors
    });
    
    res.status(500).json({ 
      error: 'Database operation failed',
      details: error.message 
    });
  }
});
// PUT - Update resolution
app.put('/api/resolutions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resolution = await Resolution.findByPk(id);
    if (!resolution) return res.status(404).json({ error: 'Resolution not found' });

    await resolution.update(req.body);
    res.json(resolution);
  } catch (error) {
    res.status(500).json({ error: 'Error updating resolution' });
  }
});

// DELETE - Remove resolution
app.delete('/api/resolutions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resolution = await Resolution.findByPk(id);
    if (!resolution) return res.status(404).json({ error: 'Resolution not found' });

    await resolution.destroy();
    res.json({ message: 'Resolution deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting resolution' });
  }
});
// Results route
// Updated /api/results endpoint
app.get('/api/results', async (req, res) => {
  try {
    // First get all resolutions without vote counts
    const resolutions = await Resolution.findAll({
      attributes: ['id', 'title', 'description', 'isActive', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    // Then get vote counts in a separate query
    const voteCounts = await Vote.findAll({
      attributes: [
        'ResolutionId',
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalVotes'],
        [sequelize.fn('SUM', sequelize.cast(sequelize.col('decision'), 'integer')), 'yesVotes']
      ],
      group: ['ResolutionId']
    });

    // Combine the data
    const formattedResults = resolutions.map(res => {
      const counts = voteCounts.find(v => v.dataValues.ResolutionId === res.id)?.dataValues || {
        totalVotes: 0,
        yesVotes: 0
      };
      
      const total = counts.totalVotes || 0;
      const yes = counts.yesVotes || 0;
      const no = total - yes;
      
      return {
        id: res.id,
        title: res.title,
        description: res.description,
        isActive: res.isActive,
        totalVotes: total,
        yesVotes: yes,
        noVotes: no,
        percentageYes: total > 0 ? Math.round((yes / total) * 100) : 0,
        percentageNo: total > 0 ? Math.round((no / total) * 100) : 0,
        status: res.isActive ? 'Active' : yes > no ? 'Passed' : 'Rejected'
      };
    });

    res.json({
      success: true,
      data: formattedResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Results error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch results',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get results for specific resolution
app.get('/api/results/:id', async (req, res) => {
  try {
    const resolution = await Resolution.findByPk(req.params.id, {
      attributes: ['id', 'title', 'description', 'createdAt']
    });

    if (!resolution) {
      return res.status(404).json({ error: 'Resolution not found' });
    }

    const votes = await Vote.findAll({
      where: { ResolutionId: req.params.id },
      include: [{
        model: RegisteredUser,
        attributes: ['id', 'name', 'holdings'],
        required: false
      }],
      order: [['createdAt', 'DESC']]
    });

    // Calculate votes and holdings
    const totalVotes = votes.length;
    const yesVotes = votes.filter(v => v.decision).length;
    const noVotes = totalVotes - yesVotes;

    // Calculate holdings - use vote.holdings first, fall back to user.holdings
    const totalHoldings = votes.reduce((sum, vote) => {
      const holdings = vote.holdings || (vote.RegisteredUser ? vote.RegisteredUser.holdings : 0);
      return sum + (holdings || 0);
    }, 0);

    const yesHoldings = votes.reduce((sum, vote) => {
      if (vote.decision) {
        const holdings = vote.holdings || (vote.RegisteredUser ? vote.RegisteredUser.holdings : 0);
        return sum + (holdings || 0);
      }
      return sum;
    }, 0);

    const noHoldings = totalHoldings - yesHoldings;

    // Format voter details
    const voterDetails = votes.map(vote => ({
      id: vote.id,
      decision: vote.decision ? 'Yes' : 'No',
      votedAt: vote.createdAt,
      holdings: vote.holdings || (vote.RegisteredUser ? vote.RegisteredUser.holdings : 0),
      voter: vote.RegisteredUser ? {
        id: vote.RegisteredUser.id,
        name: vote.RegisteredUser.name
      } : {
        id: null,
        name: 'Unknown Voter'
      }
    }));

    res.json({
      success: true,
      data: {
        resolution,
        summary: {
          totalVotes,
          yesVotes,
          noVotes,
          percentageYes: totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 0,
          percentageNo: totalVotes > 0 ? Math.round((noVotes / totalVotes) * 100) : 0,
          totalHoldings,
          yesHoldings,
          noHoldings,
          percentageYesHoldings: totalHoldings > 0 ? Math.round((yesHoldings / totalHoldings) * 100) : 0,
          percentageNoHoldings: totalHoldings > 0 ? Math.round((noHoldings / totalHoldings) * 100) : 0
        },
        votes: voterDetails
      }
    });
  } catch (error) {
    console.error('Results error:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Frontend routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

app.get('/dashboard', (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  res.sendFile(__dirname + '/public/dashboard.html');
});

app.get('/results-page', (req, res) => {
  res.sendFile(__dirname + '/public/results.html');
});

// Get all resolutions
app.get('/resolutions', async (req, res) => {
  try {
    const resolutions = await Resolution.findAll();
    res.json(resolutions);
  } catch (error) {
    res.status(500).send('Error fetching resolutions');
  }
});


// Add these endpoints
// app.get('/api/active-resolution', async (req, res) => {
//   try {
//     const resolution = await Resolution.findOne({ 
//       where: { isActive: true },
//       include: [{
//         model: Vote,
//         attributes: [
//           [Sequelize.fn('COUNT', Sequelize.fn('IF', Sequelize.col('decision'), 1, null)), 'yesVotes'],
//           [Sequelize.fn('COUNT', Sequelize.fn('IF', Sequelize.literal('NOT decision'), 1, null)), 'noVotes']
//         ]
//       }]
//     });
    
//     if (!resolution) return res.json({ active: false });
    
//     res.json({
//       active: true,
//       title: resolution.title,
//       description: resolution.description,
//       yes: resolution.Votes[0].dataValues.yesVotes,
//       no: resolution.Votes[0].dataValues.noVotes
//     });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to get active resolution' });
//   }
// });

// Admin-only endpoint
// Add these endpoints

// Activate a resolution
app.put('/api/admin/resolutions/:id/activate', async (req, res) => {
  try {
    // Deactivate all other resolutions first
    await Resolution.update({ isActive: false }, { where: {} });
    
    // Activate the selected resolution
    const resolution = await Resolution.findByPk(req.params.id);
    await resolution.update({ isActive: true });
    
    // Broadcast the update
    await broadcastResolutionUpdate();
    
    res.json(resolution);
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate resolution' });
  }
});


// app.post('/api/admin/voting/open', async (req, res) => {
//   votingState = true;
//   io.emit('voting-state', true);
//   res.json({ success: true });
// });

// app.post('/api/admin/voting/close', async (req, res) => {
//   votingState = false;
//   io.emit('voting-state', false);
//   res.json({ success: true });
// });
// Close current resolution

// Close Resolution
app.post('/api/admin/resolutions/close', async (req, res) => {
  try {
    await Resolution.update({ isActive: false }, { where: { isActive: true } });
    votingState = false; // Also close voting when resolution closes
    
    // Broadcast updates
    io.emit('resolution-closed');
    io.emit('voting-state', false);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to close resolution' });
  }
});

//Toggle Voting State
app.post('/api/admin/voting/toggle', async (req, res) => {
  try {
    // Check if there's an active resolution first
    const activeResolution = await Resolution.findOne({ where: { isActive: true } });
    if (!activeResolution) {
      return res.status(400).json({ error: 'No active resolution to vote on' });
    }

    votingState = !votingState;
    io.emit('voting-state', votingState);
    res.json({ success: true, isOpen: votingState });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle voting' });
  }
});

// Get active resolution
app.get('/api/active-resolution', async (req, res) => {
  try {
    const resolution = await Resolution.findOne({
      where: { isActive: true },
      include: [Vote] // if you're including votes
    });
    
    if (!resolution) return res.status(404).json({ message: 'No active resolution' });

    res.json(resolution);
  } catch (err) {
    console.error('Error fetching active resolution:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update results endpoint

// Update check-vote endpoint
app.get('/api/check-vote', requireAuth, async (req, res) => {
  try {
    const activeResolution = await Resolution.findOne({ 
      where: { isActive: true } 
    });
    
    if (!activeResolution) {
      return res.json({ hasVoted: false });
    }

    const vote = await Vote.findOne({
      where: {
        RegisteredUserId: req.session.userId,
        ResolutionId: activeResolution.id
      }
    });

    res.json({ 
      hasVoted: !!vote,
      userId: req.session.userId // For debugging
    });
  } catch (error) {
    console.error('Check vote error:', error);
    res.status(500).json({ error: 'Failed to check vote status' });
  }
});

// Update vote endpoint
app.post('/api/vote', requireAuth, async (req, res) => {
  try {
    const { resolutionId, decision } = req.body;
    const userId = req.session.userId;

    // Validate input
    if (typeof decision !== 'boolean' || !resolutionId) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid vote data' 
      });
    }

    // Get user with EXPLICIT holdings inclusion
    const user = await RegisteredUser.findByPk(userId, {
      attributes: ['id', 'name', 'holdings'], // Explicitly include holdings
      raw: true // Get plain object instead of model instance
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate holdings exists and is a number
    if (user.holdings === undefined || user.holdings === null) {
      console.warn(`User ${userId} has no holdings value`);
      user.holdings = 0; // Set default if missing
    }

    // Check if already voted
    const existingVote = await Vote.findOne({
      where: {
        RegisteredUserId: userId,
        ResolutionId: resolutionId
      }
    });

    if (existingVote) {
      return res.status(400).json({ error: 'Already voted' });
    }

    // Record vote with holdings
    const vote = await Vote.create({
      decision,
      RegisteredUserId: userId,
      ResolutionId: resolutionId,
      holdings: Number(user.holdings) || 0 // Ensure it's a number
    });

    // Log the vote creation for debugging
    // console.log('Created vote with holdings:', {
    //   voteId: vote.id,
    //   userId: vote.RegisteredUserId,
    //   resolutionId: vote.ResolutionId,
    //   holdings: vote.holdings
    // });
    // Calculate vote counts with holdings
    const voteCounts = await Vote.findAll({
      where: { ResolutionId: resolutionId },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('SUM', sequelize.cast(sequelize.col('decision'), 'integer')), 'yes'],
        [sequelize.fn('SUM', sequelize.literal('NOT decision')), 'no'],
        [sequelize.fn('SUM', sequelize.col('holdings')), 'totalHoldings'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN decision THEN holdings ELSE 0 END')), 'yesHoldings'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN NOT decision THEN holdings ELSE 0 END')), 'noHoldings']
      ],
      raw: true
    });

    const counts = voteCounts[0] || {
      total: 0, yes: 0, no: 0,
      totalHoldings: 0, yesHoldings: 0, noHoldings: 0
    };

    // Broadcast update with holdings data
    io.emit('vote-updated', {
      resolutionId,
      yes: counts.yes || 0,
      no: counts.no || 0,
      total: counts.total || 0,
      yesHoldings: counts.yesHoldings || 0,
      noHoldings: counts.noHoldings || 0,
      totalHoldings: counts.totalHoldings || 0
    });

    res.json({ 
      success: true,
      message: 'Vote recorded successfully',
      vote: {
        id: vote.id,
        decision: vote.decision,
        holdings: vote.holdings
      }
    });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});
// Submit a vote
// Handle votes

app.post('/api/logout', async (req, res) => {
  if (req.session.userId) {
    try {
      await RegisteredUser.update(
        { sessionId: null },
        { where: { id: req.session.userId } }
      );
    } catch (error) {
      console.error('Error clearing sessionId:', error);
    }
  }
  
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Add middleware to check for concurrent sessions
const checkConcurrentSession = async (req, res, next) => {
  if (!req.session.userId) return next();
  
  try {
    const user = await RegisteredUser.findByPk(req.session.userId);
    if (!user || user.sessionId !== req.sessionID) {
      req.session.destroy();
      return res.status(401).json({ 
        error: 'Logged in elsewhere' 
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

app.use('/api', checkConcurrentSession);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});