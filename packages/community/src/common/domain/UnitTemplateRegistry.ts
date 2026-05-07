import { FunctionalUnit } from "@ecf/core";

type TemplateFactory = () => FunctionalUnit;

interface UnitTemplate {
    type: string;
    label: string;
    description: string;
    factory: TemplateFactory;
}

/**
 * Central registry of available functional unit templates, keyed by type string.
 * Domains register their unit types here so the generic API can instantiate them
 * by type name without knowing about the concrete class.
 */
export class UnitTemplateRegistry {
    private static readonly templates: Map<string, UnitTemplate> = new Map();

    static register(template: UnitTemplate): void {
        this.templates.set(template.type, template);
    }

    static get(type: string): UnitTemplate | undefined {
        return this.templates.get(type);
    }

    static getAll(): UnitTemplate[] {
        return Array.from(this.templates.values());
    }

    static getByDomain(types: string[]): UnitTemplate[] {
        return types.flatMap(t => {
            const tmpl = this.templates.get(t);
            return tmpl ? [tmpl] : [];
        });
    }

    static create(type: string): FunctionalUnit | null {
        const tmpl = this.templates.get(type);
        return tmpl ? tmpl.factory() : null;
    }
}
