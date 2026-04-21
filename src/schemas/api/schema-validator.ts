import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@shared-core/logger';

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string | undefined;
  keyword: string;
  params: Record<string, unknown>;
  allowedValues?: unknown[];
}

export interface ContractResult {
  schemaValid: boolean;
  requiredFieldsPresent: boolean;
  missingFields: string[];
  fieldTypesMatch: boolean;
  typeErrors: string[];
  enumValuesValid: boolean;
  enumErrors: string[];
  businessRulesValid: boolean;
  businessRuleErrors: string[];
  overall: boolean;
}

export interface Contract {
  contractName: string;
  provider: string;
  consumer: string;
  endpoints: Record<string, EndpointContract>;
}

export interface EndpointContract {
  schema: string;
  requiredFields: string[];
  fieldConstraints: Record<string, FieldConstraint>;
  businessRules: string[];
}

export interface FieldConstraint {
  type?: string;
  enum?: unknown[];
  precision?: number;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
}

export class SchemaValidator {
  private static sharedState: {
    ajv: Ajv;
    validators: Map<string, ValidateFunction>;
    contracts: Map<string, Contract>;
  } | null = null;

  private ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();
  private contracts: Map<string, Contract> = new Map();
  private schemaDir: string;
  private contractDir: string;

  constructor() {
    this.schemaDir = path.resolve(process.cwd(), 'src/schemas/api/gl/json-schemas');
    this.contractDir = path.resolve(process.cwd(), 'src/schemas/api/gl/contracts');

    if (!SchemaValidator.sharedState) {
      const ajv = new Ajv({ allErrors: true, strict: false });
      addFormats(ajv);

      SchemaValidator.sharedState = {
        ajv,
        validators: new Map(),
        contracts: new Map(),
      };
    }

    this.ajv = SchemaValidator.sharedState.ajv;
    this.validators = SchemaValidator.sharedState.validators;
    this.contracts = SchemaValidator.sharedState.contracts;

    if (this.validators.size === 0) {
      this.loadSchemas();
    }

    if (this.contracts.size === 0) {
      this.loadContracts();
    }
  }

  private loadSchemas(): void {
    if (!fs.existsSync(this.schemaDir)) return;

    const files = fs.readdirSync(this.schemaDir).filter((f) => f.endsWith('.schema.json'));
    for (const file of files) {
      try {
        const schemaPath = path.join(this.schemaDir, file);
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
        const schemaId = schema.$id || path.basename(file, '.schema.json');
        this.ajv.addSchema(schema, schemaId);
        this.validators.set(schemaId, this.ajv.compile(schema));
        logger.debug('Schema loaded', { schemaId, file });
      } catch (error) {
        logger.error('Failed to load schema', { file, error });
      }
    }
  }

  private loadContracts(): void {
    if (!fs.existsSync(this.contractDir)) return;

    const files = fs.readdirSync(this.contractDir).filter((f) => f.endsWith('.contract.json'));
    for (const file of files) {
      try {
        const contractPath = path.join(this.contractDir, file);
        const contract: Contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
        this.contracts.set(contract.contractName, contract);
        logger.debug('Contract loaded', { contractName: contract.contractName });
      } catch (error) {
        logger.error('Failed to load contract', { file, error });
      }
    }
  }

  validate(schemaName: string, data: unknown): ValidationResult {
    const validate = this.validators.get(schemaName);
    if (!validate) {
      throw new Error(`Schema not found: "${schemaName}". Available: ${[...this.validators.keys()].join(', ')}`);
    }

    const valid = validate(data) as boolean;
    return {
      valid,
      errors: valid
        ? undefined
        : validate.errors?.map((e) => ({
            path: e.instancePath || '(root)',
            message: e.message,
            keyword: e.keyword,
            params: e.params as Record<string, unknown>,
            allowedValues: (e.params as Record<string, unknown>)?.allowedValues as unknown[] | undefined,
          })),
    };
  }

  validateContract(contractName: string, endpoint: string, response: Record<string, unknown>): ContractResult {
    const contract = this.findContract(contractName);
    const endpointContract = Object.entries(contract.endpoints).find(
      ([key]) => endpoint.includes(key.split(' ')[1]) || key === endpoint,
    );

    if (!endpointContract) {
      throw new Error(`No contract endpoint matching "${endpoint}" in contract "${contractName}"`);
    }

    const [, spec] = endpointContract;

    const schemaResult = this.validate(spec.schema, response);

    const missingFields = spec.requiredFields.filter((field) => {
      const value = this.getNestedValue(response, field);
      return value === undefined || value === null;
    });

    const typeErrors: string[] = [];
    const enumErrors: string[] = [];

    for (const [field, constraint] of Object.entries(spec.fieldConstraints || {})) {
      const value = this.getNestedValue(response, field);
      if (value === undefined) continue;

      if (constraint.type && typeof value !== constraint.type) {
        typeErrors.push(`Field "${field}" should be ${constraint.type} but was ${typeof value}`);
      }

      if (constraint.enum && !constraint.enum.includes(value)) {
        enumErrors.push(`Field "${field}" value "${value}" not in allowed values: [${constraint.enum.join(', ')}]`);
      }

      if (constraint.precision !== undefined && typeof value === 'number') {
        const decimals = (value.toString().split('.')[1] || '').length;
        if (decimals > constraint.precision) {
          typeErrors.push(
            `Field "${field}" exceeds precision ${constraint.precision} (has ${decimals} decimal places)`,
          );
        }
      }
    }

    const result: ContractResult = {
      schemaValid: schemaResult.valid,
      requiredFieldsPresent: missingFields.length === 0,
      missingFields,
      fieldTypesMatch: typeErrors.length === 0,
      typeErrors,
      enumValuesValid: enumErrors.length === 0,
      enumErrors,
      businessRulesValid: true,
      businessRuleErrors: [],
      overall: schemaResult.valid && missingFields.length === 0 && typeErrors.length === 0 && enumErrors.length === 0,
    };

    return result;
  }

  addSchema(schema: Record<string, unknown>, id?: string): void {
    const schemaId = id || (schema.$id as string);
    this.ajv.addSchema(schema, schemaId);
    this.validators.set(schemaId, this.ajv.compile(schema));
  }

  hasSchema(name: string): boolean {
    return this.validators.has(name);
  }

  private findContract(name: string): Contract {
    const contract =
      this.contracts.get(name) || [...this.contracts.values()].find((c) => c.contractName.includes(name));

    if (!contract) {
      throw new Error(`Contract not found: "${name}". Available: ${[...this.contracts.keys()].join(', ')}`);
    }

    return contract;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((curr, key) => {
      if (curr === null || curr === undefined) return undefined;
      return (curr as Record<string, unknown>)[key];
    }, obj);
  }

  getAvailableSchemas(): string[] {
    return [...this.validators.keys()];
  }

  getAvailableContracts(): string[] {
    return [...this.contracts.keys()];
  }
}
