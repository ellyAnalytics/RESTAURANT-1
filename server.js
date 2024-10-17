const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/myForm';
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((error) => {
  console.error('MongoDB connection error:', error);
});

// Define User Schema
const submissionSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  Message: String,
});

const Submission = mongoose.model('Submission', submissionSchema);

// Define Cart Schema
const cartItemSchema = new mongoose.Schema({
  userEmail: String,  // Changed from userId to userEmail
  productName: String,
  price: Number,
  quantity: Number,
});

const CartItem = mongoose.model('CartItem', cartItemSchema);

// Create a schema and model for registration
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
});

const User = mongoose.model('User', userSchema);

// Express session middleware for managing sessions
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
}));

// GET route for fetching cart items
app.get('/myCart', async (req, res) => {
  try {
    const cartItems = await CartItem.find();
    res.status(200).json(cartItems);
  } catch (err) {
    res.status(500).send('Error fetching cart items.');
  }
});

// POST route for comment submissions
app.post('/submit-form', async (req, res) => {
  try {
    const newSubmission = new Submission({
      firstName: req.body.fname,
      lastName: req.body.lname,
      Message: req.body.message,
    });

    await newSubmission.save();
    res.status(200).send('Submission done successfully!');
  } catch (err) {
    res.status(500).send('Error doing new registration.');
  }
});

// POST route to add item to cart
function checkLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.status(401).send('You need to sign in first.');
  }
  next();
}

app.post('/add-to-cart', checkLoggedIn, async (req, res) => {
  try {
    const { productName, price } = req.body;
    const userEmail = req.session.user.email;  // Use session email

    // Check if the item already exists in the user's cart
    let cartItem = await CartItem.findOne({ userEmail, productName });

    if (cartItem) {
      // If the item exists, increment the quantity
      cartItem.quantity += 1;
    } else {
      // If the item doesn't exist, create a new entry
      cartItem = new CartItem({
        userEmail,
        productName,
        price,
        quantity: 1,
      });
    }
    await cartItem.save();
    res.status(200).send('Item added to cart successfully!');
  } catch (err) {
    res.status(500).send('Error adding item to cart.');
  }
});

// DELETE route to remove item from cart
app.delete('/remove-from-cart/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    await CartItem.findByIdAndDelete(itemId);
    res.status(200).send('Item removed from cart successfully!');
  } catch (err) {
    res.status(500).send('Error removing item from cart.');
  }
});

// Registration route
app.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).send('Passwords do not match');
    }

    // Check if the email is already registered
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).send('Email is already registered');
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 8); // Reduced rounds for faster processing

    // Create a new user
    user = new User({
      username,
      email,
      password: hashedPassword,
    });

    await user.save();
    res.status(201).send('User registered successfully');
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Login route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).send('Email not registered');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send('Invalid password');
    }

    // Store user session
    req.session.user = { email: user.email };

    // Redirect to the landingBootstrap.html file
    return res.status(200).json({ success: true, redirectUrl: '/html/index.html' });
  } catch (err) {
    return res.status(500).send('Server error during login');
  }
});

// Serve the landingBootstrap.html (now in the public/html folder)
app.get('/html/index.html', (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, 'public/html/index.html'));
  } else {
    res.redirect('/');
  }
});

// Serve the login page (assuming it's in the public folder as index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/index.html'));
});

// Export the app for Vercel serverless functions
module.exports = app;

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
