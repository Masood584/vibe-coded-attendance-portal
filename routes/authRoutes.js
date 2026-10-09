const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only' });
  }
  next();
}

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

// POST /api/auth/register
// NOTE: for an office tool, you'd normally let only the admin create accounts.
// Kept open here (guarded by ALLOW_PUBLIC_REGISTER) so you can bootstrap the first users.
router.post('/register', async (req, res) => {
  try {
    if (process.env.ALLOW_PUBLIC_REGISTER !== 'true') {
      return res.status(403).json({ message: 'Public registration is disabled' });
    }
    const { name, email, password, department } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, department });
    const token = signToken(user);

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/auth/employees -> admin creates an employee account
router.post('/employees', auth, adminOnly, async (req, res) => {
  try {
    const { name, email, password, department } = req.body;
    if (
      typeof name !== 'string' || !name.trim() ||
      typeof email !== 'string' || !email.trim() ||
      typeof password !== 'string' || !password
    ) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const employee = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      department: typeof department === 'string' ? department.trim() : '',
      role: 'employee',
    });

    res.status(201).json({
      message: 'Employee account created',
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        role: employee.role,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    res.status(500).json({ message: 'Could not create employee', error: err.message });
  }
});

// PATCH /api/auth/employees/:employeeId -> admin updates employee name and department
router.patch('/employees/:employeeId', auth, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const { name, department } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Employee name is required' });
    }
    if (department !== undefined && typeof department !== 'string') {
      return res.status(400).json({ message: 'Department must be text' });
    }

    const employee = await User.findOneAndUpdate(
      { _id: req.params.employeeId, role: 'employee' },
      {
        $set: {
          name: name.trim(),
          department: typeof department === 'string' ? department.trim() : '',
        },
      },
      { new: true, runValidators: true, select: 'name email department role' }
    );

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({ message: 'Employee details updated', employee });
  } catch (err) {
    res.status(500).json({ message: 'Could not update employee', error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
