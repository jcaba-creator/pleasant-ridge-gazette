// Institutional Sources, Regex Matchers & Proximity Targets

export const INSTITUTIONS = {
  USD449: {
    id: 'usd449',
    name: 'USD 449 · Pleasant Ridge',
    town: 'Easton, KS',
    url: 'https://www.usd449.com',
    statusKey: 'gazette:status:usd449'
  },
  USD207: {
    id: 'usd207',
    name: 'USD 207 · Fort Leavenworth Schools',
    town: 'Fort Leavenworth, KS',
    url: 'https://www.usd207.org',
    statusKey: 'gazette:status:usd207'
  },
  GARRISON: {
    id: 'garrison',
    name: 'Fort Leavenworth Garrison',
    town: 'Fort Leavenworth, KS',
    url: 'https://home.army.mil/leavenworth/',
    statusKey: 'gazette:status:garrison'
  }
};

export const CORRIDOR_ROUTES = [
  'US-73', 'US 73', 'K-7', 'K 7', 'K-192', 'K 192', 'US-24', 'US-40', 'US 24/40', 'I-70'
];

export const CORRIDOR_PLACES = [
  'LEAVENWORTH', 'EASTON', 'LANSING', 'FORT LEAVENWORTH', 'POTTER', 'JARBALO', 'BASEHOR'
];

export const NWS_EASTON_GRID = 'https://api.weather.gov/gridpoints/EAX/34,68/forecast/hourly';
export const NWS_ALERTS_ZONE = 'https://api.weather.gov/alerts/active?zone=KSZ103';

// USGS 06891850 is Stranger Creek at Easton, KS (Flood stage 17.0 ft). 06890900 is Delaware River at Perry.
export const USGS_STRANGER_CREEK = 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=06891850,06890900&parameterCd=00065';
export const KDOT_WZDX_FEED = 'https://ks.carsprogram.org/carsapi_v1/api/wzdx';
