import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TypeScriptLSP } from "../src/servers/typescript";
import * as path from "path";

describe("Extended Navigation Commands", () => {
  let lsp: TypeScriptLSP;
  const testProjectPath = path.resolve(__dirname, "../test-project");

  beforeAll(async () => {
    lsp = new TypeScriptLSP(testProjectPath);
    await lsp.start();
  });

  afterAll(async () => {
    await lsp.stop();
  });

  describe("typeDefinition", () => {
    it("should find type definition of Calculator import", async () => {
      const result = await lsp.getTypeDefinition(
        path.join(testProjectPath, "src/index.ts"),
        1,  // line 1: import { Calculator }
        10  // position on Calculator
      );

      expect(result).toHaveLength(1);
      expect(result[0].uri).toContain("calculator.ts");
      expect(result[0].range.start.line).toBe(3); // class definition line
    });

    it("should find type definition of User type", async () => {
      const result = await lsp.getTypeDefinition(
        path.join(testProjectPath, "src/index.ts"),
        14, // line 14: const user: User
        14  // position on User
      );

      expect(result).toHaveLength(1);
      expect(result[0].uri).toContain("types/user.ts");
    });
  });

  describe("implementation", () => {
    it("should find implementations of UserService interface", async () => {
      const result = await lsp.getImplementation(
        path.join(testProjectPath, "src/types/user.ts"),
        7,  // interface line
        17  // position on interface name
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // Should find implementations in user.service.ts and index.ts
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("documentSymbols", () => {
    it("should list all symbols in calculator.ts", async () => {
      const result = await lsp.getDocumentSymbols(
        path.join(testProjectPath, "src/calculator.ts")
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      // Should find Calculator class
      const calculatorClass = result.find((s: any) => s.name === "Calculator");
      expect(calculatorClass).toBeDefined();
      expect(calculatorClass.kind).toBe(5); // Class kind
    });

    it("should list symbols in index.ts", async () => {
      const result = await lsp.getDocumentSymbols(
        path.join(testProjectPath, "src/index.ts")
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      // Should find main function and variables
      const symbols = result.map((s: any) => s.name);
      expect(symbols).toContain("main");
      expect(symbols).toContain("calculator");
      expect(symbols).toContain("userService");
    });
  });

  describe("workspaceSymbols", () => {
    it("should find Calculator symbol in workspace", async () => {
      const result = await lsp.getWorkspaceSymbols("Calculator");

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      // Should find Calculator class and calculator variable
      const calculatorClass = result.find((s: any) => 
        s.name === "Calculator" && s.kind === 5
      );
      expect(calculatorClass).toBeDefined();
      expect(calculatorClass.location.uri).toContain("calculator.ts");
    });

    it("should find User-related symbols", async () => {
      const result = await lsp.getWorkspaceSymbols("User");

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      // Should find User interface, UserRole enum, UserService class
      const userSymbols = result.filter((s: any) => 
        s.name.includes("User")
      );
      expect(userSymbols.length).toBeGreaterThan(0);
    });

    it("should return empty array for non-existent symbol", async () => {
      const result = await lsp.getWorkspaceSymbols("NonExistentSymbol");

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe("hover", () => {
    it("should provide hover information for calculator variable", async () => {
      const result = await lsp.getHover(
        path.join(testProjectPath, "src/index.ts"),
        9,  // line 9: const calculator = new Calculator()
        7   // position on calculator variable
      );

      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
      expect(result.contents).toContain("Calculator");
    });

    it("should provide hover information for a variable", async () => {
      const result = await lsp.getHover(
        path.join(testProjectPath, "src/index.ts"),
        10, // line 10: const userService = new UserService()
        7   // position on userService variable
      );

      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
      // Should show UserService type
      expect(result.contents).toContain("UserService");
    });

    it("should provide hover information for type", async () => {
      const result = await lsp.getHover(
        path.join(testProjectPath, "src/index.ts"),
        4,  // line 4: import { User, UserRole }
        10  // position on User
      );

      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
    });
  });
});