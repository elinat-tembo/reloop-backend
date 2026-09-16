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
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, createSwapRequest);
router.get('/incoming', auth, getIncomingSwapRequests);
router.get('/outgoing', auth, getOutgoingSwapRequests);
router.get('/:id', auth, getSwapRequestById);
router.patch('/:id/accept', auth, acceptSwapRequest);
router.patch('/:id/reject', auth, rejectSwapRequest);
router.patch('/:id/cancel', auth, cancelSwapRequest);

module.exports = router;
