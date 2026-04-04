const addDays = (value, days) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const addHours = (value, hours) => {
  const next = new Date(value);
  next.setHours(next.getHours() + hours);
  return next;
};

const addMinutes = (value, minutes) => {
  const next = new Date(value);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
};

const startOfDay = (value = new Date()) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

module.exports = { addDays, addHours, addMinutes, startOfDay };
