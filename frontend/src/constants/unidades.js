export const UNIDADES = [
  { value: 'kg', label: 'Kilogramos (kg)', decimales: 2 },
  { value: 'g', label: 'Gramos (g)', decimales: 0 },
  { value: 'l', label: 'Litros (l)', decimales: 2 },
  { value: 'ml', label: 'Mililitros (ml)', decimales: 0 },
  { value: 'unidad', label: 'Unidades', decimales: 0 },
];

export const getDecimalesUnidad = (unidad) => {
  const found = UNIDADES.find((u) => u.value === unidad);
  return found ? found.decimales : 2;
};

export const formatStock = (valor, unidad) => {
  const decimales = getDecimalesUnidad(unidad);
  return parseFloat(valor).toFixed(decimales);
};
