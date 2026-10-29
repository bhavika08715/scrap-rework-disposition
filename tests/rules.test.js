const { decide } = require('../services/disposition/rules');
test('cheap scratch is reworked', () => expect(decide({ defectType: 'surface_scratch', severity: 2, unitValue: 100, quantity: 10 }).decision).toBe('REWORK'));
test('crack is always scrapped', () => expect(decide({ defectType: 'crack', severity: 1, unitValue: 100, quantity: 1 }).decision).toBe('SCRAP'));
test('severity 5 is scrapped even if reworkable', () => expect(decide({ defectType: 'surface_scratch', severity: 5, unitValue: 100, quantity: 1 }).decision).toBe('SCRAP'));
test('expensive rework is scrapped', () => expect(decide({ defectType: 'weld_porosity', severity: 4, unitValue: 100, quantity: 1 }).decision).toBe('SCRAP'));
test('large scrap loss needs approval', () => expect(decide({ defectType: 'crack', severity: 3, unitValue: 5000, quantity: 5 }).requiresApproval).toBe(true));
test('small scrap loss needs no approval', () => expect(decide({ defectType: 'crack', severity: 3, unitValue: 100, quantity: 5 }).requiresApproval).toBe(false));
