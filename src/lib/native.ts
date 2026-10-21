import { Capacitor } from '@capacitor/core';

/** True inside the Android app (Capacitor), where the app's files ship inside the APK. */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/**
 * Saves a text file. In the browser this is a regular download; in the Android app (whose WebView
 * cannot download blob URLs) the file is written to the app's cache and handed to the share sheet,
 * so it can be saved to Files/Drive or sent.
 */
export async function saveTextFile(name: string, text: string, mime = 'application/json'): Promise<void> {
  if (isNativeApp()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, files: [uri] });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
