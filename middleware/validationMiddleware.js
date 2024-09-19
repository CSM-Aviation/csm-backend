const { body, validationResult } = require('express-validator');

exports.validateLogin = [
    body('username').isString().trim().notEmpty(),
    body('password').isString().notEmpty(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

// Add more validation middleware for other routes