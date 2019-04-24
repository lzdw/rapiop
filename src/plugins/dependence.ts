import $script from 'scriptjs';
import _ from 'lodash';

interface DependenceShape {
    dependences: string[];
    file: string[];
}

interface DependenceMap {
    [key: string]: string | string[] | DependenceShape;
}

interface Option {
    getDependenceMap: () => Promise<DependenceMap>;
    baseUrl: string;
}

class Plugin {
    dependenceMap: DependenceMap;
    baseUrl: string;
    queue: (() => {})[] = [];
    constructor(option: Option) {
        const { getDependenceMap, baseUrl = '' } = option;
        this.baseUrl = baseUrl;
        getDependenceMap().then((map = {}) => {
            this.dependenceMap = map;
            if (this.queue.length) {
                this.queue.forEach(load => {
                    load();
                });
            }
        });
    }
    bind = (app: any) => {
        app.loadDependences = this.loadDependences;
    };
    loadDependences = async (dependences: string[], callback?: () => {}) => {
        function isShape(dependenceInfo: string | string[] | DependenceShape): dependenceInfo is DependenceShape {
            return Object.prototype.toString.call(dependenceInfo) === '[object Object]';
        }
        const load = async () => {
            const _load = (dependenceFiles: string[]) => {
                const getFilePath = (file: string) => this.baseUrl + '/' + file;

                dependenceFiles = dependenceFiles.map((file: string) => getFilePath(file));

                return new Promise(resolve => {
                    $script(dependenceFiles, () => resolve());
                });
            };

            let dependedDependences: string[] = [];
            let dependenceFiles: string[] = [];
            dependences.forEach((dependence: string) => {
                const dependenceInfo = this.dependenceMap[dependence];
                if (isShape(dependenceInfo)) {
                    dependedDependences = dependedDependences.concat(dependenceInfo.dependences);
                    dependenceFiles = dependenceFiles.concat(dependenceInfo.file);
                } else {
                    dependenceFiles = dependenceFiles.concat(dependenceInfo);
                }
            });

            if (!_.isEmpty(dependedDependences)) {
                await this.loadDependences(dependedDependences);
            }
            await _load(dependenceFiles);
        };
        return new Promise(resolve => {
            const _callback = () => {
                callback && callback();
                resolve();
            };
            if (this.dependenceMap) {
                load().then(_callback);
            } else {
                this.queue.push(() => load().then(_callback));
            }
        });
    };
}

export default Plugin;