export function toReadableString(str: string): string {
  return str.replace(/\_/g, ' ').split(' ').map(s => `${s.slice(0, 1)}${s.slice(1).toLowerCase()}`).join(' ');
}

export function randomString(length: integer, seeded: boolean = false) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = seeded ? randSeedInt(characters.length) : Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  
  return result;
}

export function shiftCharCodes(str: string, shiftCount: integer) {
  if (!shiftCount)
    shiftCount = 0;
  
  let newStr = '';

  for (let i = 0; i < str.length; i++) {
      let charCode = str.charCodeAt(i);
      let newCharCode = charCode + shiftCount;
      newStr += String.fromCharCode(newCharCode);
  }

  return newStr;
}

export function clampInt(value: integer, min: integer, max: integer): integer {
  return Math.min(Math.max(value, min), max);
}

export function randGauss(stdev: number, mean: number = 0): number {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}

export function randSeedGauss(stdev: number, mean: number = 0): number {
  const u = 1 - Phaser.Math.RND.realInRange(0, 1);
  const v = Phaser.Math.RND.realInRange(0, 1);
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}

export function padInt(value: integer, length: integer, padWith?: string): string {
  if (!padWith)
    padWith = '0';
  let valueStr = value.toString();
  while (valueStr.length < length)
    valueStr = `${padWith}${valueStr}`;
  return valueStr;
}

export function randInt(range: integer, min: integer = 0): integer {
  if (range === 1)
    return min;
  return Math.floor(Math.random() * range) + min;
}

export function randSeedInt(range: integer, min: integer = 0): integer {
  if (range <= 1)
    return min;
  return Phaser.Math.RND.integerInRange(min, (range - 1) + min);
}

export function randIntRange(min: integer, max: integer): integer {
  return randInt(max - min, min);
}

export function getSunday(date: Date): Date {
  const day = date.getDay(),
  diff = date.getDate() - day;
  const newDate = new Date(date.setDate(diff));
  return new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
}

export function getFrameMs(frameCount: integer): integer {
  return Math.floor((1 / 60) * 1000 * frameCount);
}

export function getCurrentTime(): number {
  const date = new Date();
  return (((date.getHours() * 60 + date.getMinutes()) / 1440) + 0.675) % 1;
}

const secondsInHour = 3600;

export function getPlayTimeString(totalSeconds: integer): string {
  const days = `${Math.floor(totalSeconds / (secondsInHour * 24))}`;
  const hours = `${Math.floor(totalSeconds % (secondsInHour * 24) / secondsInHour)}`;
  const minutes = `${Math.floor(totalSeconds % secondsInHour / 60)}`;
  const seconds = `${Math.floor(totalSeconds % 60)}`;

  return `${days.padStart(2, '0')}:${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
}

export function binToDec(input: string): integer {
  let place: integer[] = []; 
  let binary: string[] = [];
  
  let decimalNum = 0;
  
  for (let i = 0; i < input.length; i++) {
    binary.push(input[i]);
    place.push(Math.pow(2, i));
    decimalNum += place[i] * parseInt(binary[i]);
  }

  return decimalNum;
}

export function decToBin(input: integer): string {
  let bin = '';
  let intNum = input;
  while (intNum > 0) {
    bin = intNum % 2 ? `1${bin}` : `0${bin}`;
    intNum = Math.floor(intNum * 0.5);
  }

  return bin;
}

export function getEnumKeys(enumType): string[] {
  return Object.values(enumType).filter(v => isNaN(parseInt(v.toString()))).map(v => v.toString());
}

export function getEnumValues(enumType): integer[] {
  return Object.values(enumType).filter(v => !isNaN(parseInt(v.toString()))).map(v => parseInt(v.toString()));
}

export function executeIf<T>(condition: boolean, promiseFunc: () => Promise<T>): Promise<T> {
  return condition ? promiseFunc() : new Promise<T>(resolve => resolve(null));
}

export const sessionIdKey = 'pokerogue_sessionId';
export const isLocal = window.location.hostname === 'localhost';
export const serverUrl = isLocal ? 'http://localhost:8001' : '';
export const apiUrl = isLocal ? serverUrl : 'api';

export function setCookie(cName: string, cValue: string): void {
  document.cookie = `${cName}=${cValue};SameSite=Strict;path=/`;
}

export function getCookie(cName: string): string {
  const name = `${cName}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ')
      c = c.substring(1);
    if (c.indexOf(name) === 0)
      return c.substring(name.length, c.length);
  }
  return '';
}

export function apiFetch(path: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    const sId = getCookie(sessionIdKey);
    const headers = sId ? { 'Authorization': sId } : {};
    fetch(`${apiUrl}/${path}`, { headers: headers })
      .then(response => resolve(response))
      .catch(err => reject(err));
  });
}

export function apiPost(path: string, data?: any, contentType: string = 'application/json'): Promise<Response> {
  return new Promise((resolve, reject) => {
    const headers = {
      'Accept': contentType,
      'Content-Type': contentType,
    };
    const sId = getCookie(sessionIdKey);
    if (sId)
      headers['Authorization'] = sId;
    fetch(`${apiUrl}/${path}`, { method: 'POST', headers: headers, body: data })
      .then(response => resolve(response))
      .catch(err => reject(err));
  });
}

export class BooleanHolder {
  public value: boolean;

  constructor(value: boolean) {
    this.value = value;
  }
}

export class NumberHolder {
  public value: number;

  constructor(value: number) {
    this.value = value;
  }
}

export class IntegerHolder extends NumberHolder {
  constructor(value: integer) {
    super(value);
  }
}

export class FixedInt extends IntegerHolder {
  constructor(value: integer) {
    super(value);
  }
}

export function fixedInt(value: integer): integer {
  return new FixedInt(value) as unknown as integer;
}

export function rgbToHsv(r: integer, g: integer, b: integer) {
  let v = Math.max(r, g, b);
  let c = v - Math.min(r, g, b);
  let h = c && ((v === r) ? (g - b) / c : ((v === g) ? 2 + (b - r) / c : 4 + (r - g) / c)); 
  return [ 60 * (h < 0 ? h + 6 : h), v && c / v, v];
}

/**
 * Compare color difference in RGB
 * @param {Array} rgb1 First RGB color in array
 * @param {Array} rgb2 Second RGB color in array
 */
export function deltaRgb(rgb1: integer[], rgb2: integer[]): integer {
  const [ r1, g1, b1 ] = rgb1;
  const [ r2, g2, b2 ] = rgb2;
  const drp2 = Math.pow(r1 - r2, 2);
  const dgp2 = Math.pow(g1 - g2, 2);
  const dbp2 = Math.pow(b1 - b2, 2);
  const t = (r1 + r2) / 2;

  return Math.ceil(Math.sqrt(2 * drp2 + 4 * dgp2 + 3 * dbp2 + t * (drp2 - dbp2) / 256));
}