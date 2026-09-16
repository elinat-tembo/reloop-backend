const express = require('express');

const {
  createSwapRequest,
  getIncomingSwapRequests,
  getOutgoingSwapRequests,
  getSwapRequestById,
  acceptSwapRequest,
  rejectSwapRequest,
  cancelSwapRequest,
} = require('../controllers/swapController');
const { sendMessage, getMessages } = require('../controllers/messageController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, createSwapRequest);
router.get('/incoming', auth, getIncomingSwapRequests);
router.get('/outgoing', auth, getOutgoingSwapRequests);
router.get('/:id', auth, getSwapRequestById);
router.patch('/:id/accept', auth, acceptSwapRequest);
router.patch('/:id/reject', auth, rejectSwapRequest);
router.patch('/:id/cancel', auth, cancelSwapRequest);
router.post('/:swapId/messages', auth, sendMessage);
router.get('/:swapId/messages', auth, getMessages);

module.exports = router;
