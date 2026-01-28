{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { nixpkgs, ... }:
    let
      system = "aarch64-darwin";
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = with pkgs; [
          nodejs_24
          nodePackages.pnpm
        ];
        
        shellHook = ''
          echo "🚀 Node.js development environment"
          echo "Node.js: $(node --version)"
          echo "pnpm: $(pnpm --version)"
        '';
      };
    };
}
