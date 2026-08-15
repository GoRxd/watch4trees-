import { SafeStorage } from './storage.helper';

describe('SafeStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should store and retrieve string values', () => {
    SafeStorage.setItem('test_key', 'test_val');
    expect(SafeStorage.getItem('test_key')).toEqual('test_val');
  });

  it('should store and retrieve JSON values', () => {
    const testObj = { name: 'Tree', count: 5 };
    SafeStorage.setJSON('obj_key', testObj);
    expect(SafeStorage.getJSON('obj_key')).toEqual(testObj);
  });

  it('should return fallback if key not found', () => {
    expect(SafeStorage.getJSON('non_existent', { fallback: true })).toEqual({ fallback: true });
  });

  it('should remove item when setJSON is passed null', () => {
    SafeStorage.setItem('remove_key', 'some_val');
    SafeStorage.setJSON('remove_key', null);
    expect(SafeStorage.getItem('remove_key')).toBeNull();
  });
});
