import { PermissionsAndroid } from 'react-native'

/** Pede o microfone ao Android (RECORD_AUDIO). Falso se a pessoa negou: ela entra na chamada só ouvindo. */
export async function ensureMicPermission(): Promise<boolean> {
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
  return result === PermissionsAndroid.RESULTS.GRANTED
}
