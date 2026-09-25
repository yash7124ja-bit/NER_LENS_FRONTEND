export const mission = {
  id: 'ML-0176',
  status: 'In Progress',
  route: 'Dimapur (Pickup) → Kohima (Delivery)',
  vehicle: 'Truck (5T)',
  eta: '6h 20m',
  distance: '178 km',
  progress: 0.42,
};

export const route = {
  pickup: 'Dimapur',
  destination: 'Kohima',
  eta: '6h 20m',
  distance: '178 km',
  hazards: [{ label: '!', top: '30%', left: '42%' }, { label: '!', top: '48%', left: '70%' }, { label: '!', top: '65%', left: '25%' }],
};

export const alerts = [
  { id: '1', severity: 'High', title: 'Landslide Risk', distance: '2.3 km ahead', source: 'Bridge', time: '1h ago', image: '⛰️' },
  { id: '2', severity: 'Medium', title: 'Heavy Rain', distance: '12 km ahead', source: 'NH-29', time: '3h ago', image: '🌧️' },
  { id: '3', severity: 'High', title: 'Road Blocked', distance: '24 km ahead', source: 'Bridge', time: '1h ago', image: '🚧' },
  { id: '4', severity: 'Medium', title: 'Weight Restriction', distance: '42 km ahead', source: '5T limit', time: '2h ago', image: '⚖️' },
];

export const reports = [
  { id: '1', title: 'Landslide Report', detail: '2.3 km · 1h ago', freshness: 'Fresh evidence', icon: '⛰️' },
  { id: '2', title: 'Heavy Rain Report', detail: '12 km · 3h ago', freshness: 'Fresh evidence', icon: '🌧️' },
  { id: '3', title: 'Road Blocked Report', detail: '24 km · 5h ago', freshness: 'Evidence 2h old', icon: '🚧' },
  { id: '4', title: 'Vehicle Problem Report', detail: '48 km · 6h ago', freshness: 'Evidence 5h old', icon: '🔧' },
];
