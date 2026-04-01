import XXH from "xxhashjs";

export type HashInput = string | Uint8Array | ArrayBuffer;

function normalizeHashInput(value: HashInput): string | Buffer {
	if (typeof value === "string") {
		return value;
	}
	if (value instanceof ArrayBuffer) {
		return Buffer.from(value);
	}
	return Buffer.from(value);
}

export function hashValue64BigInt(value: HashInput): bigint {
	const hex = XXH.h64(normalizeHashInput(value), 0x0).toString(16).padStart(16, "0");
	return BigInt(`0x${hex}`);
}

export function hashValue64Hex(value: HashInput): string {
	return hashValue64BigInt(value).toString(16);
}

export function hashValue64Base36(value: HashInput): string {
	return hashValue64BigInt(value).toString(36);
}

export function hashText64Base36(value: string): string {
	return hashValue64Base36(value);
}

export function hashValue32(value: HashInput): number {
	return XXH.h32(normalizeHashInput(value), 0x0).toNumber();
}

export function hashValue32WithSeed(value: HashInput, seed: number): number {
	return XXH.h32(normalizeHashInput(value), seed >>> 0).toNumber();
}
