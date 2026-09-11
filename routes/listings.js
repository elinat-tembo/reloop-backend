const express = require('express');

const {
  createListing,
  getListings,
  getMyListings,
  getListingById,
  updateListing,
  deleteListing,
} = require('../controllers/listingController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, createListing);
router.get('/', auth, getListings);
router.get('/mine', auth, getMyListings);
router.get('/:id', auth, getListingById);
router.put('/:id', auth, updateListing);
router.delete('/:id', auth, deleteListing);

module.exports = router;
