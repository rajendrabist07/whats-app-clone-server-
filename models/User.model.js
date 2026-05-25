import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [20, 'Username cannot exceed 20 characters'],
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters'],
        select: false, // NEVER return password in queries by default
    },
    avatar: {
        url: { type: String, default: '' },
        publicId: { type: String, default: '' }, // Cloudinary public_id for deletion
    },
    bio: { type: String, maxlength: 150, default: '' },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    refreshToken: { type: String, select: false }, // Stored for token rotation
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
});

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return; // Only hash if password changed
    const salt = await bcrypt.genSalt(12); // 12 rounds is the sweet spot
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.isPasswordMatch = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Indexes for performance
userSchema.index({ username: 'text', email: 'text' }); // Text search
userSchema.index({ isOnline: 1 });

export const User = mongoose.model('User', userSchema);
