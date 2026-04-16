export type DiffToken = { text: string; changed: boolean };

/**
 * Compare two strings word-by-word and return tokens with `changed` flag
 * for words that differ. Uses a simple LCS-based diff.
 */
export function diffWords(
  textA: string,
  textB: string
): { tokensA: DiffToken[]; tokensB: DiffToken[] } {
  const wordsA = textA.split(/(\s+)/);
  const wordsB = textB.split(/(\s+)/);

  const norm = (w: string) => w.trim().toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]/g, '');

  // Build LCS table
  const m = wordsA.length;
  const n = wordsB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (norm(wordsA[i - 1]) === norm(wordsB[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find common subsequence
  const commonA = new Set<number>();
  const commonB = new Set<number>();
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (norm(wordsA[i - 1]) === norm(wordsB[j - 1])) {
      commonA.add(i - 1);
      commonB.add(j - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const tokensA: DiffToken[] = wordsA.map((text, idx) => ({
    text,
    changed: !commonA.has(idx) && text.trim().length > 0,
  }));

  const tokensB: DiffToken[] = wordsB.map((text, idx) => ({
    text,
    changed: !commonB.has(idx) && text.trim().length > 0,
  }));

  return { tokensA, tokensB };
}
