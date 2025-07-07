type OGPMetadata = {
	title: string;
	description: string;
	image: string;
};

type OGPJson = Record<string, OGPMetadata>;

export class R2OGPManager {
	private accountId: string;
	private accessKeyId: string;
	private secretAccessKey: string;
	private bucketName: string;
	private isPreview: boolean;

	constructor(config: {
		accountId: string;
		accessKeyId: string;
		secretAccessKey: string;
		bucketName?: string;
		isPreview?: boolean;
	}) {
		this.accountId = config.accountId;
		this.accessKeyId = config.accessKeyId;
		this.secretAccessKey = config.secretAccessKey;
		this.isPreview = config.isPreview ?? false;
		this.bucketName =
			config.bucketName ?? (this.isPreview ? "wagomu-ogp-cache-preview" : "box-of-rubber-bands");
	}

	private getR2Endpoint(): string {
		return `https://${this.accountId}.r2.cloudflarestorage.com`;
	}

	private async generateSignature(
		method: string,
		path: string,
		headers: Record<string, string>,
		date: string
	): Promise<string> {
		const crypto = globalThis.crypto || (await import("node:crypto")).webcrypto;

		const canonicalRequest = [
			method,
			path,
			"",
			Object.entries(headers)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([k, v]) => `${k.toLowerCase()}:${v}`)
				.join("\n"),
			"",
			Object.keys(headers)
				.sort()
				.map((k) => k.toLowerCase())
				.join(";"),
			"UNSIGNED-PAYLOAD",
		].join("\n");

		const algorithm = { name: "HMAC", hash: "SHA-256" };
		const encoder = new TextEncoder();

		const dateKey = await crypto.subtle.importKey(
			"raw",
			encoder.encode("AWS4" + this.secretAccessKey),
			algorithm,
			false,
			["sign"]
		);

		const dateRegionKey = await crypto.subtle.sign(
			algorithm,
			dateKey,
			encoder.encode(date.slice(0, 8))
		);

		const dateRegionServiceKey = await crypto.subtle.sign(
			algorithm,
			await crypto.subtle.importKey("raw", dateRegionKey, algorithm, false, ["sign"]),
			encoder.encode("auto")
		);

		const signingKey = await crypto.subtle.sign(
			algorithm,
			await crypto.subtle.importKey("raw", dateRegionServiceKey, algorithm, false, ["sign"]),
			encoder.encode("s3")
		);

		const finalKey = await crypto.subtle.sign(
			algorithm,
			await crypto.subtle.importKey("raw", signingKey, algorithm, false, ["sign"]),
			encoder.encode("aws4_request")
		);

		const hashedCanonicalRequest = await crypto.subtle.digest(
			"SHA-256",
			encoder.encode(canonicalRequest)
		);

		const stringToSign = [
			"AWS4-HMAC-SHA256",
			date,
			`${date.slice(0, 8)}/auto/s3/aws4_request`,
			Array.from(new Uint8Array(hashedCanonicalRequest))
				.map((b) => b.toString(16).padStart(2, "0"))
				.join(""),
		].join("\n");

		const signature = await crypto.subtle.sign(
			algorithm,
			await crypto.subtle.importKey("raw", finalKey, algorithm, false, ["sign"]),
			encoder.encode(stringToSign)
		);

		return Array.from(new Uint8Array(signature))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}

	private async makeR2Request(
		method: string,
		path: string,
		body?: ArrayBuffer | string,
		contentType?: string
	): Promise<Response> {
		const date = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, "");
		const endpoint = this.getR2Endpoint();
		const url = `${endpoint}/${this.bucketName}${path}`;

		const headers: Record<string, string> = {
			"x-amz-date": date,
			"x-amz-content-sha256": "UNSIGNED-PAYLOAD",
			host: new URL(endpoint).hostname,
		};

		if (contentType) {
			headers["content-type"] = contentType;
		}

		const signature = await this.generateSignature(
			method,
			`/${this.bucketName}${path}`,
			headers,
			date
		);

		const authHeader = [
			"AWS4-HMAC-SHA256",
			`Credential=${this.accessKeyId}/${date.slice(0, 8)}/auto/s3/aws4_request`,
			`SignedHeaders=${Object.keys(headers).sort().join(";")}`,
			`Signature=${signature}`,
		].join(", ");

		return fetch(url, {
			method,
			headers: {
				...headers,
				Authorization: authHeader,
			},
			body,
		});
	}

	async checkImageExists(path: string): Promise<boolean> {
		try {
			const response = await this.makeR2Request("HEAD", `/ogp/${path}`);
			return response.ok;
		} catch (error) {
			console.error(`Error checking image existence for ${path}:`, error);
			return false;
		}
	}

	async uploadImage(path: string, image: ArrayBuffer): Promise<boolean> {
		try {
			const response = await this.makeR2Request("PUT", `/ogp/${path}`, image, "image/png");
			return response.ok;
		} catch (error) {
			console.error(`Error uploading image for ${path}:`, error);
			return false;
		}
	}

	async downloadImage(path: string): Promise<ArrayBuffer | null> {
		try {
			const response = await this.makeR2Request("GET", `/ogp/${path}`);
			if (response.ok) {
				return await response.arrayBuffer();
			}
			return null;
		} catch (error) {
			console.error(`Error downloading image for ${path}:`, error);
			return null;
		}
	}

	async getOGPMetadata(): Promise<OGPJson | null> {
		try {
			const response = await this.makeR2Request("GET", "/ogp/metadata.json");
			if (response.ok) {
				const text = await response.text();
				return JSON.parse(text) as OGPJson;
			}
			return null;
		} catch (error) {
			console.error("Error fetching OGP metadata:", error);
			return null;
		}
	}

	async updateOGPMetadata(metadata: OGPJson): Promise<boolean> {
		try {
			const response = await this.makeR2Request(
				"PUT",
				"/ogp/metadata.json",
				JSON.stringify(metadata, null, 2),
				"application/json"
			);
			return response.ok;
		} catch (error) {
			console.error("Error updating OGP metadata:", error);
			return false;
		}
	}

	async listDailyImages(): Promise<string[]> {
		try {
			const response = await this.makeR2Request("GET", "/?list-type=2&prefix=ogp/daily/");
			if (response.ok) {
				const text = await response.text();
				const parser = new DOMParser();
				const doc = parser.parseFromString(text, "application/xml");
				const keys = Array.from(doc.querySelectorAll("Key"))
					.map((node) => node.textContent || "")
					.filter((key) => key.endsWith(".png"))
					.map((key) => key.replace("ogp/", ""));
				return keys;
			}
			return [];
		} catch (error) {
			console.error("Error listing daily images:", error);
			return [];
		}
	}
}

export function createR2Manager(env?: {
	CLOUDFLARE_ACCOUNT_ID?: string;
	CLOUDFLARE_R2_ACCESS_KEY_ID?: string;
	CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string;
	CLOUDFLARE_R2_BUCKET_NAME?: string;
	NODE_ENV?: string;
}): R2OGPManager | null {
	const accountId = env?.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
	const accessKeyId = env?.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
	const secretAccessKey =
		env?.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
	const bucketName = env?.CLOUDFLARE_R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME;
	const isPreview = (env?.NODE_ENV || process.env.NODE_ENV) !== "production";

	if (!accountId || !accessKeyId || !secretAccessKey) {
		console.warn("R2 credentials not found. R2 caching will be disabled.");
		return null;
	}

	return new R2OGPManager({
		accountId,
		accessKeyId,
		secretAccessKey,
		bucketName,
		isPreview,
	});
}
