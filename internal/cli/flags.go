package cli

import (
	"fmt"
	"strconv"
	"strings"
)

// flagSet is a parsed command line: the options found in it, wherever they
// appeared, and the positional arguments in the order they were written.
type flagSet struct {
	values     map[string]string
	bools      map[string]bool
	positional []string
}

// helpFlag is accepted by every command.
const helpFlag = "help"

// parseFlags collects options and positionals from args.
//
// Options are recognised anywhere in the arguments, not only before the
// positionals, because `moogo bucket ls --json avatars/` reads the way people
// write it. A flag that takes a value consumes the next argument unless it was
// written as --name=value.
func parseFlags(args []string, takesValue, isBool map[string]bool) (*flagSet, error) {
	parsed := &flagSet{values: map[string]string{}, bools: map[string]bool{}}

	for index := 0; index < len(args); index++ {
		argument := args[index]

		// A lone dash is stdin, a real positional. A single dash before a
		// letter is the same option people type out of habit from other tools.
		if argument == "-h" {
			argument = "--" + helpFlag
		}

		if argument == "-" || !strings.HasPrefix(argument, "--") {
			parsed.positional = append(parsed.positional, argument)
			continue
		}

		name, value, written := strings.Cut(strings.TrimPrefix(argument, "--"), "=")
		switch {
		case takesValue[name]:
			if !written {
				if index+1 >= len(args) {
					return nil, fmt.Errorf("--%s needs a value", name)
				}
				index++
				value = args[index]
			}
			parsed.values[name] = value

		case isBool[name]:
			if !written {
				value = "true"
			}
			enabled, err := strconv.ParseBool(value)
			if err != nil {
				return nil, fmt.Errorf("--%s takes true or false, got %q", name, value)
			}
			parsed.bools[name] = enabled

		default:
			return nil, fmt.Errorf("unknown flag --%s", name)
		}
	}

	return parsed, nil
}

// sharedFlags returns fresh copies of the option tables every command starts
// from: the flags that choose who a command talks as, plus --help.
//
// Copies rather than shared maps because each command adds its own options to
// them, and a package-level map would make one command's flags leak into the
// next one's usage.
func sharedFlags() (takesValue, isBool map[string]bool) {
	takesValue = map[string]bool{
		"url":            true,
		"key":            true,
		"storage-key-id": true,
		"storage-key":    true,
	}
	isBool = map[string]bool{helpFlag: true}
	return takesValue, isBool
}

// wantsHelp reports whether the command line asked for its own help text.
func (flags *flagSet) wantsHelp() bool {
	return flags.bools[helpFlag]
}

// value returns a flag's value, or "" when it was not given.
func (flags *flagSet) value(name string) string {
	return flags.values[name]
}

// number returns a flag's value as an integer, rejecting anything else rather
// than silently sending a non-numeric limit to the API.
func (flags *flagSet) number(name string) (int, error) {
	raw, given := flags.values[name]
	if !given {
		return 0, nil
	}

	value, err := strconv.Atoi(raw)
	if err != nil || value < 0 {
		return 0, &commandError{fmt.Errorf("--%s must be a whole number, got %q", name, raw)}
	}
	return value, nil
}

// first returns the first non-empty value, which is how a flag overrides the
// environment without the environment having to be unset.
func first(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
