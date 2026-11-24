export interface CodeSymbol {
    name: string;
    type: "class" | "id";
    line: number;
    column: number;
}

export class Document {
    constructor(protected text: string) { }

    get lines(): number {
        if (this.text.length === 0) return 0;

        let count = 1;
        for (let i = 0; i < this.text.length; i++) {
            if (this.text[i] === "\n") {
                count++;
            }
        }
        return count;
    }

    turnDocToArray(): string[] {
        if (this.text === "") return [];
        return this.text.split(/\r?\n/);
    }

    count(phrase: string): number {
        if (phrase === "") return 0;
        return this.text.split(phrase).length - 1;
    }
}

export class HTML extends Document {
    constructor(htmlText: string) {
        super(htmlText);
    }

    findSymbols(): CodeSymbol[] {
        const symbols: CodeSymbol[] = [];
        const docArray = this.turnDocToArray();

        for (let lineIdx = 0; lineIdx < docArray.length; lineIdx++) {
            const lineText = docArray[lineIdx] ?? "";

            // HTML classes
            for (const match of lineText.matchAll(/class\s*=\s*["']([^"']+)["']/g)) {
                const fullMatch = match[0];
                const rawClasses = match[1] ?? "";
                const startCol = (match.index ?? 0) + fullMatch.indexOf(rawClasses);
                let offset = 0;

                for (const cls of rawClasses.split(/\s+/)) {
                    if (cls) {
                        symbols.push({
                            name: cls,
                            type: "class",
                            line: lineIdx + 1,
                            column: startCol + offset + 1,
                        });
                    }
                    offset += cls.length + 1;
                }
            }

            // HTML Ids
            for (const match of lineText.matchAll(/id\s*=\s*["']([^"']+)["']/g)) {
                const fullMatch = match[0];
                const idName = (match[1] ?? "").trim();
                if (idName) {
                    symbols.push({
                        name: idName,
                        type: "id",
                        line: lineIdx + 1,
                        column: (match.index ?? 0) + fullMatch.indexOf(idName) + 1,
                    });
                }
            }

            // CSS classes & IDs
            for (const match of lineText.matchAll(/(?:^|[\s,{>+~])([.#])([a-zA-Z_-][\w-]*)/g)) {
                const fullMatch = match[0];
                const prefix = match[1] ?? "";
                const name = match[2] ?? "";
                if (name && (prefix === "." || prefix === "#")) {
                    symbols.push({
                        name,
                        type: prefix === "." ? "class" : "id",
                        line: lineIdx + 1,
                        column: (match.index ?? 0) + fullMatch.indexOf(prefix) + 1,
                    });
                }
            }
        }

        return symbols;
    }

    countClasses(): number {
        return this.findSymbols().filter((s) => s.type === "class").length;
    }

    countIds(): number {
        return this.findSymbols().filter((s) => s.type === "id").length;
    }
}

export class CSS extends Document {
    constructor(cssText: string) {
        super(cssText);
    }

    findSymbols(): CodeSymbol[] {
        const symbols: CodeSymbol[] = [];
        const docArray = this.turnDocToArray();

        for (let lineIdx = 0; lineIdx < docArray.length; lineIdx++) {
            const lineText = docArray[lineIdx] ?? "";

            for (const match of lineText.matchAll(/(?:^|[\s,{>+~])([.#])([a-zA-Z_-][\w-]*)/g)) {
                const fullMatch = match[0];
                const prefix = match[1] ?? "";
                const name = match[2] ?? "";
                if (name && (prefix === "." || prefix === "#")) {
                    symbols.push({
                        name,
                        type: prefix === "." ? "class" : "id",
                        line: lineIdx + 1,
                        column: (match.index ?? 0) + fullMatch.indexOf(prefix) + 1,
                    });
                }
            }
        }

        return symbols;
    }

    countClasses(): number {
        return this.findSymbols().filter((s) => s.type === "class").length;
    }

    countIds(): number {
        return this.findSymbols().filter((s) => s.type === "id").length;
    }
}