import { checkUploadFile, isHeic, MAX_UPLOAD_BYTES } from './files';

describe('upload checks', () => {
  it('accepts supported photo types', () => {
    for (const type of [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/HEIF',
    ]) {
      expect(checkUploadFile({ name: 'a', type, size: 10 })).toBeNull();
    }
  });

  it('accepts HEIC by extension when the browser reports no type', () => {
    expect(
      checkUploadFile({ name: 'IMG_1.HEIC', type: '', size: 10 }),
    ).toBeNull();
    expect(isHeic({ name: 'IMG_1.HEIC', type: '' })).toBe(true);
  });

  it('rejects other types, empty and huge files', () => {
    expect(
      checkUploadFile({ name: 'a.pdf', type: 'application/pdf', size: 10 }),
    ).toMatch(/Unsupported/);
    expect(checkUploadFile({ name: 'a.txt', type: '', size: 10 })).toMatch(
      /Unsupported/,
    );
    expect(
      checkUploadFile({ name: 'a.jpg', type: 'image/jpeg', size: 0 }),
    ).toMatch(/empty/);
    expect(
      checkUploadFile({
        name: 'a.jpg',
        type: 'image/jpeg',
        size: MAX_UPLOAD_BYTES + 1,
      }),
    ).toMatch(/too large/);
  });
});
