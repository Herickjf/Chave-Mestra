import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import { dictionary, adjacencyGraphs } from '@zxcvbn-ts/language-common';

zxcvbnOptions.setOptions({ dictionary, graphs: adjacencyGraphs });

export const passwordScore = (password: string) => (password ? zxcvbn(password).score : 0);
export const passwordStrong = (password: string) =>
  password.length >= 12 && passwordScore(password) >= 3;
