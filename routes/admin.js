const express = require('express');

const {
  getAllUsers,
  deactivateUser,
  activateUser,
  getAllListings,
  forceDeleteListing,
  getAllSwaps,
  getSwapMessages,
  forceSwapStatus,
  getAnalytics,
} = require('../controllers/adminController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

router.use(auth, admin);

router.get('/users', getAllUsers);
router.patch('/users/:id/deactivate', deactivateUser);
router.patch('/users/:id/activate', activateUser);

router.get('/listings', getAllListings);
router.delete('/listings/:id', forceDeleteListing);

router.get('/swaps', getAllSwaps);
router.get('/swaps/:id/messages', getSwapMessages);
router.patch('/swaps/:id/force-status', forceSwapStatus);

router.get('/analytics', getAnalytics);

module.exports = router;
