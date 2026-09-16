const LOCATIONS = {
  'Lusaka Province': ['Lusaka', 'Kafue', 'Chongwe', 'Chilanga'],
  'Copperbelt Province': ['Ndola', 'Kitwe', 'Chingola', 'Mufulira', 'Luanshya'],
  'Southern Province': ['Livingstone', 'Choma', 'Mazabuka', 'Monze'],
  'Other Provinces': ['Kabwe', 'Chipata', 'Kasama', 'Solwezi'],
};

const REGIONS = Object.keys(LOCATIONS);
const CITIES = Object.values(LOCATIONS).flat();

module.exports = { LOCATIONS, REGIONS, CITIES };
