export const requirements = [
  { id: 'length', label: 'At least 10 characters', test: (p) => p?.length >= 10 },
  { id: 'uppercase', label: 'One uppercase letter (A-Z)', test: (p) => /[A-Z]/?.test(p) },
  { id: 'lowercase', label: 'One lowercase letter (a-z)', test: (p) => /[a-z]/?.test(p) },
  { id: 'number', label: 'One number (0-9)', test: (p) => /[0-9]/?.test(p) },
  { id: 'special', label: 'One special character (!@#$...)', test: (p) => /[^A-Za-z0-9]/?.test(p) },
];
