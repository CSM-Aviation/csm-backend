const mongoose = require('mongoose');

const ConfigurationSchema = new mongoose.Schema({
  header_color: {
    type: String,
    required: true
  },
  home_video: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('Configuration', ConfigurationSchema);